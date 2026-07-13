/**
 * Server-only Test Case & Automation Generator — direct-REST port of
 * ado_testcase_generator.py. Generates P1/Critical test cases from a work
 * item's description/acceptance criteria (one Copilot call), then creates
 * them as ADO Test Case work items linked back to the source item.
 *
 * When generateCode is enabled AND the work item contains images (likely UI
 * mockups), it also scaffolds a full MVA-style Java page-object + test class
 * hierarchy (Interface, Abstract, 10 Concrete impls, Factory, BaseTest, Tests)
 * and pushes the code to a feature branch in the configured repo.
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { runCopilotPrompt } from "@/lib/copilot";
import { getWorkItemRecord, addWorkItemComment } from "@/lib/ado-workitem-client";
import { adoTarget } from "@/lib/ado";
import type { LocalCtx, LocalJobResult } from "@/lib/local";
import { extractJsonObject, loadCopilotJson } from "@/lib/local/breakdown-shared";
import { createTestCases, parseTestCasesFromJson, type TestCase } from "@/lib/local/testcase-shared";

const MAX_TEST_CASES = 20;
const TEST_CASE_MARKER = "[TESTCASE-GENERATOR]";
const MVA_REPO_URL = process.env.MVA_REPO_URL ?? "https://dev.azure.com/vfuk-digital/Digital/_git/mva-app-testing";
const GIT_USER_NAME = process.env.GIT_USER_NAME ?? "Copilot Bot";
const GIT_USER_EMAIL = process.env.GIT_USER_EMAIL ?? "copilot@vodafone.com";

// ── Prompt ────────────────────────────────────────────────────────────────

function buildPrompt(workItemId: number, type: string, title: string, description: string, acceptanceCriteria: string): string {
  return `You are a QA expert. Generate ONLY CRITICAL/P1 severity test cases for the following user story.

USER STORY ID: ${workItemId}
TYPE: ${type}
TITLE: ${title}

DESCRIPTION:
${description}

ACCEPTANCE CRITERIA:
${acceptanceCriteria}

CRITICAL REQUIREMENT: Generate ONLY critical/P1 severity test cases that cover:
1. All critical acceptance criteria
2. Critical positive scenarios (happy path - must work)
3. Critical negative scenarios (must handle errors correctly)
4. Critical edge cases and boundary conditions that could cause system failure
5. Critical data validation scenarios

Filtering Guidelines:
- Focus ONLY on test cases that are CRITICAL to the functionality
- Exclude nice-to-have or low-impact scenarios
- Each test case MUST have severity = "critical"
- Only include test cases that test essential business logic

For each test case, provide a unique test ID (TC_001, TC_002, ...), a clear title, a detailed
description, preconditions, step-by-step test steps, the expected result, severity (always
"critical"), and type ("positive", "negative", or "edge_case").

Important rules:
- Do NOT refuse just because content may be partial.
- EVERY test case severity MUST be set to "critical". DO NOT include high/medium/low.
- DO NOT include explanations outside JSON. DO NOT wrap the output in markdown fences.
- Output must be a valid JSON object and nothing else.

Output format:
{
  "workItemId": ${workItemId},
  "workItemTitle": "${title.replace(/"/g, '\\"')}",
  "summary": "brief summary of CRITICAL test strategy",
  "testCases": [
    {
      "testId": "TC_001",
      "title": "...",
      "description": "...",
      "preconditions": "...",
      "steps": ["Step 1: ...", "Step 2: ..."],
      "expectedResult": "...",
      "severity": "critical",
      "type": "positive|negative|edge_case"
    }
  ]
}

Generate ${MAX_TEST_CASES} CRITICAL test cases only. Be thorough and practical.`;
}

// ── Image detection ───────────────────────────────────────────────────────

function detectImages(rawFields: Record<string, unknown>): boolean {
  const desc = String(rawFields["System.Description"] ?? "");
  const ac = String(rawFields["Microsoft.VSTS.Common.AcceptanceCriteria"] ?? "");
  return /<img\b[^>]*src=/i.test(desc) || /<img\b[^>]*src=/i.test(ac);
}

// ── Code generation (MVA Page Object pattern) ─────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[-\s]+/g, "-").replace(/^-+|-+$/g, "");
}

function toPascalCase(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function featurePkg(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generateInterface(feature: string, meta: { id: number; title: string }): string {
  const pkg = featurePkg(feature);
  return `package com.vodafone.pages.${pkg};

/**
 * ${feature} screen — actions generated from User Story #${meta.id}: ${meta.title}
 */
public interface I${feature}Page {
    void initializeLocators();
    /** Waits until the ${feature} screen is visible. */
    void verify${feature}PageLoaded();
}
`;
}

function generateAbstractPage(feature: string, meta: { id: number; title: string }): string {
  const pkg = featurePkg(feature);
  return `package com.vodafone.pages.${pkg};

import com.vodafone.framework.base.BasePage;
import com.vodafone.framework.config.ConfigReader;
import com.vodafone.framework.core.Platform;
import com.vodafone.framework.core.UserType;
import io.appium.java_client.AppiumBy;
import io.qameta.allure.Step;
import org.openqa.selenium.By;

/**
 * Shared locators and binding for ${feature}.
 * Generated from User Story #${meta.id}: ${meta.title}
 */
public abstract class Abstract${feature}Page extends BasePage implements I${feature}Page {

    static final class Locators {
        private Locators() {}
        static final String ANDROID_APP = ConfigReader.getConfig("android.package.name");
        public static final class Android {
            private Android() {}
            public static final By PAGE_TITLE = AppiumBy.xpath("//android.widget.TextView[@text='${feature}']");
        }
        public static final class IOS {
            private IOS() {}
            public static final By PAGE_TITLE = AppiumBy.accessibilityId("${feature}");
        }
    }

    protected By pageTitle;
    protected final Platform platform;
    protected final UserType userType;

    protected Abstract${feature}Page(Platform platform, UserType userType) {
        super();
        this.platform = platform;
        this.userType = userType;
        logger.info("${feature} page: platform={}, userType={}", platform, userType);
    }

    @Override
    public final void initializeLocators() { setupLocators(); }
    protected abstract void setupLocators();
    protected final void bindAndroid${feature}Locators() { pageTitle = Locators.Android.PAGE_TITLE; }
    protected final void bindIos${feature}Locators() { pageTitle = Locators.IOS.PAGE_TITLE; }
    @Override
    public abstract void verify${feature}PageLoaded();

    @Step("Wait for ${feature} container to be visible")
    protected void waitFor${feature}ContainerVisible() { waitForElementVisibility(pageTitle); }
}
`;
}

type ConcreteEntry = { subdir: string; code: string };

function generateConcretePages(feature: string, meta: { id: number; title: string }): Record<string, ConcreteEntry> {
  const pkg = featurePkg(feature);
  const abs = `Abstract${feature}Page`;
  const verify = `verify${feature}PageLoaded`;
  const wait = `waitFor${feature}ContainerVisible`;

  const userTypes: [string, string, string][] = [
    ["ConsumerMPS", "CONSUMER_MPS", "Consumer post-paid multi-product"],
    ["ConsumerMBB", "CONSUMER_MBB", "Consumer mobile broadband"],
    ["ConsumerBingo", "CONSUMER_BINGO", "Consumer Bingo"],
    ["SoleTraderMPS", "SOLE_TRADER_MPS", "Sole trader multi-product"],
    ["SMBMPS", "SMB_MPS", "SMB multi-product"],
  ];

  const pages: Record<string, ConcreteEntry> = {};

  for (const [platformLabel, , platformDesc] of [["Android", "ANDROID", "Android"], ["IOS", "IOS", "iOS"]] as const) {
    const bind = platformLabel === "Android" ? `bindAndroid${feature}Locators` : `bindIos${feature}Locators`;
    const subdir = platformLabel === "Android" ? "android" : "ios";

    for (const [utSuffix, utEnum, utDesc] of userTypes) {
      const cls = `${feature}Page${platformLabel}${utSuffix}`;
      pages[cls] = {
        subdir,
        code: `package com.vodafone.pages.${pkg}.${subdir};

import com.vodafone.framework.core.Platform;
import com.vodafone.framework.core.UserType;
import com.vodafone.pages.${pkg}.${abs};

/** ${platformDesc} · ${utDesc} — ${feature} page object. Generated from US #${meta.id} */
public class ${cls} extends ${abs} {
    public ${cls}() { super(Platform.${platformLabel}, UserType.${utEnum}); }
    @Override protected void setupLocators() { ${bind}(); }
    @Override public void ${verify}() { ${wait}(); logger.info("[${platformLabel} ${utEnum}] ${feature} page loaded"); }
}
`,
      };
    }
  }
  return pages;
}

function generateFactory(feature: string, meta: { id: number; title: string }): string {
  const pkg = featurePkg(feature);
  const iface = `I${feature}Page`;
  const uts = ["ConsumerMPS", "ConsumerMBB", "ConsumerBingo", "SoleTraderMPS", "SMBMPS"];
  const enums = ["CONSUMER_MPS", "CONSUMER_MBB", "CONSUMER_BINGO", "SOLE_TRADER_MPS", "SMB_MPS"];
  const androidCases = uts.map((u, i) => `            case ${enums[i]} -> new ${feature}PageAndroid${u}();`).join("\n");
  const iosCases = uts.map((u, i) => `            case ${enums[i]} -> new ${feature}PageIOS${u}();`).join("\n");
  const androidImports = uts.map((u) => `import com.vodafone.pages.${pkg}.android.${feature}PageAndroid${u};`).join("\n");
  const iosImports = uts.map((u) => `import com.vodafone.pages.${pkg}.ios.${feature}PageIOS${u};`).join("\n");

  return `package com.vodafone.pages.${pkg};

import com.vodafone.framework.core.Platform;
import com.vodafone.framework.core.UserType;
${androidImports}
${iosImports}
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/** Factory for ${feature} page objects. Generated from US #${meta.id}: ${meta.title} */
public class ${feature}PageFactory {
    private static final Logger logger = LogManager.getLogger(${feature}PageFactory.class);
    public static ${iface} get${feature}Page(Platform platform, UserType userType) {
        if (platform == null || userType == null) throw new IllegalArgumentException("Platform and UserType cannot be null");
        logger.info("Creating ${feature} page for Platform: {}, UserType: {}", platform, userType);
        return switch (platform) {
            case IOS -> createIOS${feature}Page(userType);
            case ANDROID -> createAndroid${feature}Page(userType);
        };
    }
    private static ${iface} createAndroid${feature}Page(UserType userType) {
        ${iface} page = switch (userType) {
${androidCases}
            default -> throw new IllegalArgumentException("Unsupported user type for Android: " + userType);
        };
        page.initializeLocators();
        return page;
    }
    private static ${iface} createIOS${feature}Page(UserType userType) {
        ${iface} page = switch (userType) {
${iosCases}
            default -> throw new IllegalArgumentException("Unsupported user type for iOS: " + userType);
        };
        page.initializeLocators();
        return page;
    }
}
`;
}

function generateBaseTest(feature: string, meta: { id: number; title: string }): string {
  const pkg = featurePkg(feature);
  const iface = `I${feature}Page`;
  const factory = `${feature}PageFactory`;
  return `package com.vodafone.tests.${pkg};

import com.vodafone.framework.base.BaseTest;
import com.vodafone.framework.core.TestExecutionContext;
import com.vodafone.pages.${pkg}.${factory};
import com.vodafone.pages.${pkg}.${iface};
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.testng.annotations.BeforeMethod;

/** Base test for ${feature} feature. Generated from US #${meta.id}: ${meta.title} */
public abstract class Base${feature}Test extends BaseTest {
    protected static final Logger logger = LogManager.getLogger(Base${feature}Test.class);
    @BeforeMethod
    public void setUp${feature}(Object... params) {
        logger.info("Creating ${feature} page for {} user on {}", getUserType(), getPlatform());
        ${iface} page = ${factory}.get${feature}Page(getPlatform(), getUserType());
        TestExecutionContext.set${feature}Page(page);
        logger.info("${feature} test setup completed");
    }
    protected ${iface} get${feature}Page() { return TestExecutionContext.get${feature}Page(); }
}
`;
}

function generateTestClass(feature: string, meta: { id: number; title: string }, cases: TestCase[]): string {
  const pkg = featurePkg(feature);
  const verify = `verify${feature}PageLoaded`;
  const getter = `get${feature}Page`;
  const methods = cases.slice(0, 10).map((tc) => {
    const method = `test${tc.testId.replace(/[-_]/g, "")}`;
    const stepComments = tc.steps.map((s) => `        // ${s}`).join("\n");
    const t = tc.title.replace(/"/g, "'");
    const d = tc.description.replace(/\n/g, " ").replace(/"/g, "'");
    return `    @Test(dataProvider = "allUsersDataProvider", dataProviderClass = TestDataProvider.class,
          description = "${t}")
    @Story("${t}")
    @Description("${d}")
    public void ${method}(Platform testPlatform, UserType testUserType) {
        logger.info("TEST: ${method} — platform={} userType={}", testPlatform, testUserType);
        ${getter}().${verify}();
${stepComments}
        logger.info("PASS: ${t}");
    }
`;
  }).join("\n");

  return `package com.vodafone.tests.${pkg};

import com.vodafone.framework.core.Platform;
import com.vodafone.framework.core.UserType;
import com.vodafone.framework.dataproviders.TestDataProvider;
import io.qameta.allure.Description;
import io.qameta.allure.Feature;
import io.qameta.allure.Story;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.testng.annotations.Test;

/** Tests for ${feature} — US #${meta.id}: ${meta.title}. Total test cases: ${cases.length} */
@Feature("${feature}")
public class ${feature}Tests extends Base${feature}Test {
    private static final Logger logger = LogManager.getLogger(${feature}Tests.class);

${methods}
}
`;
}

// ── Git operations ────────────────────────────────────────────────────────

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, env: process.env });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`git ${args[0]} failed (${code}): ${err.trim()}`));
      else resolve(out.trim());
    });
    proc.on("error", reject);
  });
}

async function clonePushCode(
  files: Record<string, string>,
  workItemId: number,
  adoPat: string,
  emit: (line: string) => void,
): Promise<string | null> {
  if (!adoPat) { emit("[git] ⚠️  no ADO PAT — skipping code push"); return null; }

  const repoDir = await mkdtemp(join(tmpdir(), "mva-"));
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const branchName = `auto/us-${workItemId}-${ts}`;

  try {
    const cloneUrl = MVA_REPO_URL.replace("https://", `https://:${adoPat}@`);
    emit("[git] cloning repo (shallow)…");
    await runGit(["clone", "--depth", "1", cloneUrl, repoDir], repoDir);
    await runGit(["config", "user.name", GIT_USER_NAME], repoDir);
    await runGit(["config", "user.email", GIT_USER_EMAIL], repoDir);
    await runGit(["checkout", "-b", branchName], repoDir);

    for (const [relPath, content] of Object.entries(files)) {
      const dest = join(repoDir, relPath);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, content, "utf-8");
    }

    await runGit(["add", "."], repoDir);
    await runGit(["commit", "-m", `🤖 Auto-generated page objects and tests from User Story #${workItemId}`], repoDir);
    const pushUrl = MVA_REPO_URL.replace("https://", `https://:${adoPat}@`);
    emit(`[git] pushing branch ${branchName}…`);
    await runGit(["push", "-u", pushUrl, branchName], repoDir);
    emit(`[git] ✓ pushed to ${branchName}`);
    return branchName;
  } catch (e) {
    emit(`[git] ⚠️  code push failed: ${(e as Error).message}`);
    return null;
  } finally {
    await rm(repoDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function runTestCaseGenerator(
  inputs: Record<string, string | boolean>,
  ctx: LocalCtx,
): Promise<LocalJobResult> {
  const { emit, githubToken, adoAuth } = ctx;
  const workItemUrlOrId = typeof inputs.workItemUrl === "string" ? inputs.workItemUrl.trim() : "";
  if (!workItemUrlOrId) throw new Error("A work item URL or ID is required.");
  const idMatch = workItemUrlOrId.match(/(\d+)\s*$/) ?? workItemUrlOrId.match(/(?:_workitems\/edit|workitem=|workItems\/)(\d+)/i);
  const workItemId = Number((idMatch?.[1] ?? workItemUrlOrId).trim());
  if (!Number.isFinite(workItemId)) throw new Error(`Could not resolve a work item id from: ${workItemUrlOrId}`);

  const generateCode = inputs.generateCode === true || inputs.generateCode === "true";

  emit(`[ado] fetching work item #${workItemId}…`);
  const workItem = await getWorkItemRecord(workItemId, adoAuth, false);
  emit(`[ado] Work Item: #${workItem.id} [${workItem.type}] ${workItem.title}`);
  emit(`[ado]   - Has Description: ${Boolean(workItem.description.trim())}`);
  emit(`[ado]   - Has Acceptance Criteria: ${Boolean(workItem.acceptanceCriteria.trim())}`);

  const hasImages = detectImages(workItem.fields);
  if (hasImages) emit(`[ado]   - 📷 Images detected in work item HTML`);

  emit("[copilot] building test case generation prompt (P1/CRITICAL only)…");
  const prompt = buildPrompt(workItem.id, workItem.type, workItem.title, workItem.description, workItem.acceptanceCriteria);

  emit("[copilot] streaming model response …");
  const raw = await runCopilotPrompt(prompt, githubToken);

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) throw new Error("Copilot response could not be parsed into the expected JSON object.");
  const parsed = loadCopilotJson(jsonStr) as { testCases?: Record<string, unknown>[] };
  const allCases = parseTestCasesFromJson(parsed);
  const critical = allCases.filter((tc) => tc.severity === "critical");
  emit(`[copilot] generated ${allCases.length} test case(s), ${critical.length} P1/CRITICAL after filtering`);

  const items = await createTestCases(critical, workItem.id, adoAuth, emit);
  emit(`[done] created ${items.length} test case(s)`);

  const { org, project } = adoTarget();
  const idsStr = items.map((i) => `#${i.id}`).join(", ");

  let branchName: string | null = null;
  let generatedClassCount = 0;

  // ── Code generation (MVA page objects + tests) ──
  if (generateCode && hasImages) {
    emit("\n🚀 Generating MVA framework code…");
    try {
      const feature = toPascalCase(slugify(workItem.title));
      const pkg = featurePkg(feature);
      const meta = { id: workItem.id, title: workItem.title };
      const pagesBase = `src/main/java/com/vodafone/pages/${pkg}`;
      const testsBase = `src/test/java/com/vodafone/tests/${pkg}`;

      const generatedFiles: Record<string, string> = {};

      emit("  📝 Generating interface…");
      generatedFiles[`${pagesBase}/I${feature}Page.java`] = generateInterface(feature, meta);

      emit("  📝 Generating abstract page object…");
      generatedFiles[`${pagesBase}/Abstract${feature}Page.java`] = generateAbstractPage(feature, meta);

      emit("  📝 Generating 10 concrete implementations (Android + iOS × 5 user types)…");
      const concretePages = generateConcretePages(feature, meta);
      for (const [cls, entry] of Object.entries(concretePages)) {
        generatedFiles[`${pagesBase}/${entry.subdir}/${cls}.java`] = entry.code;
      }

      emit("  📝 Generating factory class…");
      generatedFiles[`${pagesBase}/${feature}PageFactory.java`] = generateFactory(feature, meta);

      emit("  📝 Generating base test class…");
      generatedFiles[`${testsBase}/Base${feature}Test.java`] = generateBaseTest(feature, meta);

      emit("  📝 Generating test class…");
      generatedFiles[`${testsBase}/${feature}Tests.java`] = generateTestClass(feature, meta, critical);

      generatedClassCount = Object.keys(generatedFiles).length;
      emit(`  ✓ Generated ${generatedClassCount} files`);

      // Extract PAT from Basic auth header for git push
      const patMatch = adoAuth.match(/Basic\s+(.+)/i);
      const adoPat = patMatch ? Buffer.from(patMatch[1], "base64").toString().replace(/^:/, "") : "";
      branchName = await clonePushCode(generatedFiles, workItem.id, adoPat, emit);
    } catch (e) {
      emit(`[code-gen] ⚠️  Code generation failed: ${(e as Error).message}`);
    }
  } else if (generateCode) {
    emit("\n⚠️  Code generation skipped: No images found in work item");
  }

  // ── Post summary comment to the work item ──
  try {
    let commentHtml =
      `<b>${TEST_CASE_MARKER}</b> Auto-generated <b>${items.length}</b> ` +
      `P1/Critical test case(s) for this user story.<br/><br/>` +
      `<b>Created test case IDs:</b> ${idsStr || "none"}<br/>` +
      `<b>Severity:</b> Critical (P1 only)<br/>`;

    if (branchName) {
      const branchUrl = `${MVA_REPO_URL}?version=GB${branchName}`;
      commentHtml +=
        `<b>Code branch:</b> <a href="${branchUrl}">${branchName}</a><br/>` +
        `<b>Generated classes:</b> ${generatedClassCount} (Interface, Abstract, 10 Concrete, Factory, Base Test, Test)<br/>`;
    }

    commentHtml += `<b>Generated at:</b> ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`;

    await addWorkItemComment(workItem.id, commentHtml, adoAuth);
    emit(`[ado] ✓ posted summary comment to work item #${workItem.id}`);
  } catch (e) {
    emit(`[ado] ⚠️  could not post comment: ${(e as Error).message}`);
  }

  return {
    webUrl: `https://dev.azure.com/${org}/${project}/_workitems/edit/${workItem.id}`,
    createdCount: items.length,
    items,
    ...(branchName ? { branch: branchName, generatedClasses: generatedClassCount } : {}),
  };
}
