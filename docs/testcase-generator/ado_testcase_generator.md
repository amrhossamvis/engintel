# User Story Test Case Generator - Usage Guide

## 📋 Overview

The User Story Test Case Generator is an AI-powered automation tool that automatically generates comprehensive P1/Critical test cases from Azure DevOps user stories and posts them directly to Azure DevOps as Test Case work items.

### Key Features
- ✅ **AI-Powered:** Uses GitHub Copilot CLI for intelligent test case generation
- ✅ **Automatic Azure Integration:** Creates test cases and links them to parent work items
- ✅ **P1/Critical Focus:** Generates only critical priority test cases
- ✅ **Comprehensive Coverage:** Positive, negative, and edge case scenarios
- ✅ **Multiple Output Formats:** JSON, Markdown, Python, Java (optional)
- ✅ **Smart Parsing:** Handles HTML, Markdown, and plain text acceptance criteria

## 🚀 Quick Start

### Prerequisites

1. **Python 3.8 or higher**
   ```bash
   python --version  # Should be 3.8+
   ```

2. **Required Python packages**
   ```bash
   pip install requests
   ```

3. **GitHub Copilot CLI** (optional, will use gh CLI auth if not provided)
   ```bash
   # Install gh CLI first (if not already installed)
   brew install gh  # macOS
   # or
   curl -sS https://webi.sh/gh | sh  # Linux
   
   # Login to GitHub
   gh auth login
   
   # Install Copilot extension
   gh extension install github/gh-copilot
   ```

4. **Azure DevOps Access**
   - Personal Access Token (PAT) with Work Items Read & Write permissions
   - Organization name
   - Project name

### Basic Usage

```bash
# Set environment variables
export WORK_ITEM_ID=4201189
export SYSTEM_ACCESSTOKEN="your-azure-devops-pat-token"
export ADO_ORG="vfuk-digital"
export ADO_PROJECT="Digital"

# Run the generator
python userstory_testcase_generator.py
```

### Expected Output

```
Fetching work item #4201189...
Work Item: #4201189 [User Story] Implement user authentication
  - Has Description: True
  - Has Acceptance Criteria: True

Building test case generation prompt...
  NOTE: Generating ONLY P1/CRITICAL severity test cases

Invoking GitHub Copilot CLI...
Generated 15 test cases from Copilot
Filtered to 15 CRITICAL (P1) test cases
✓ Total P1/Critical test cases to post: 15

Posting 15 critical test cases to Azure DevOps...
  [1/15] Posted: TC_001
  ✓ Created test case #4201190
  ✓ Linked test case #4201190 to work item #4201189
  [2/15] Posted: TC_002
  ✓ Created test case #4201191
  ✓ Linked test case #4201191 to work item #4201189
  ...

✓ Successfully posted 15 P1/CRITICAL test cases to Azure DevOps
✓ Created test case IDs: [4201190, 4201191, 4201192, ...]
✓ Test case mapping saved to: test_cases_mapping_us4201189.json
```

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `WORK_ITEM_ID` or `ADO_WORK_ITEM_ID` | Azure DevOps work item ID | `4201189` |
| `SYSTEM_ACCESSTOKEN` or `ADO_PAT` | Azure DevOps Personal Access Token | `your-pat-token` |
| `ADO_ORG` or `SYSTEM_COLLECTIONURI` | Azure DevOps organization name | `vfuk-digital` |
| `ADO_PROJECT` or `SYSTEM_TEAMPROJECT` | Azure DevOps project name | `Digital` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` | GitHub token for Copilot CLI (falls back to gh CLI auth) | Uses `gh` CLI auth | `ghp_xxxx...` |
| `MAX_TEST_CASES` | Maximum number of test cases to generate | `50` | `30` |
| `MAX_WORK_ITEM_TEXT` | Maximum characters from work item | `1200000` | `500000` |

## 📝 Detailed Usage Examples

### Example 1: Basic Generation for User Story

```bash
#!/bin/bash

# Generate test cases for a user story
WORK_ITEM_ID=4201189 \
SYSTEM_ACCESSTOKEN="ypqr4xxxxxxxxxxxxxxxxxx" \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python userstory_testcase_generator.py
```

### Example 2: Generate for Bug Work Item

```bash
#!/bin/bash

# Same script works for bugs, tasks, etc.
WORK_ITEM_ID=4201250 \
SYSTEM_ACCESSTOKEN="ypqr4xxxxxxxxxxxxxxxxxx" \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python userstory_testcase_generator.py
```

### Example 3: Custom Test Case Limit

```bash
#!/bin/bash

# Generate more test cases
MAX_TEST_CASES=30 \
WORK_ITEM_ID=4201189 \
SYSTEM_ACCESSTOKEN="ypqr4xxxxxxxxxxxxxxxxxx" \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python userstory_testcase_generator.py
```

### Example 4: Using GitHub Token Directly

```bash
#!/bin/bash

# Provide GitHub token instead of using gh CLI
WORK_ITEM_ID=4201189 \
SYSTEM_ACCESSTOKEN="ypqr4xxxxxxxxxxxxxxxxxx" \
GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxxx" \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python userstory_testcase_generator.py
```

### Example 5: Using SYSTEM Variables (Azure Pipelines)

```bash
#!/bin/bash

# These are automatically available in Azure Pipelines
WORK_ITEM_ID=4201189 \
python userstory_testcase_generator.py

# Uses:
# - SYSTEM_ACCESSTOKEN (auto-provided by pipeline)
# - SYSTEM_COLLECTIONURI (auto-provided)
# - SYSTEM_TEAMPROJECT (auto-provided)
```

## 🔐 Setting Up Azure DevOps Personal Access Token (PAT)

### Step 1: Create PAT

1. Go to Azure DevOps: `https://dev.azure.com/{your-org}`
2. Click on **User Settings** (top right) → **Personal Access Tokens**
3. Click **+ New Token**
4. Configure:
   - **Name:** `Test Case Generator`
   - **Organization:** Select your org
   - **Expiration:** Choose duration (90 days recommended)
   - **Scopes:** Select **Custom defined**
     - ✅ **Work Items:** Read & Write
   - Click **Create**
5. **Copy the token immediately** (you won't see it again!)

### Step 2: Set Environment Variable

```bash
# For current session
export SYSTEM_ACCESSTOKEN="your-copied-token"

# For permanent setup (add to ~/.bashrc or ~/.zshrc)
echo 'export SYSTEM_ACCESSTOKEN="your-copied-token"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Verify Access

```bash
# Test the token
curl -u ":${SYSTEM_ACCESSTOKEN}" \
  "https://dev.azure.com/{your-org}/_apis/projects?api-version=7.1"
```

## 🤖 Setting Up GitHub Copilot CLI

### Option 1: Use GitHub CLI Authentication (Recommended)

```bash
# Install gh CLI
brew install gh  # macOS
# or
curl -sS https://webi.sh/gh | sh  # Linux/WSL

# Authenticate
gh auth login

# Install Copilot extension
gh extension install github/gh-copilot

# Verify installation
gh copilot --version
```

The script will automatically use the `gh` CLI authentication when no GitHub token is provided.

### Option 2: Use GitHub Personal Access Token

1. Go to GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Configure:
   - **Note:** `Copilot CLI Access`
   - **Expiration:** 90 days
   - **Scopes:** 
     - ✅ `repo` (if using private repos)
     - ✅ `read:user`
4. Click **Generate token**
5. Copy the token

```bash
# Set the token
export GH_TOKEN="ghp_xxxxxxxxxxxxxxxx"
```

## 📦 Output Files

### Test Case Mapping File

After successful execution, a mapping file is created:

**Filename:** `test_cases_mapping_us{WORK_ITEM_ID}.json`

**Example Content:**
```json
{
  "workItemId": 4201189,
  "createdTestCaseIds": [
    4201190,
    4201191,
    4201192,
    4201193,
    4201194
  ],
  "testCaseCount": 5,
  "severity": "critical",
  "timestamp": "2026-04-06T14:30:45.123456"
}
```

**Use Cases:**
- Track which test cases were created for a work item
- Audit trail for test case generation
- Bulk operations on generated test cases
- Reporting and analytics

## 🎯 Understanding Generated Test Cases

### Test Case Structure in Azure DevOps

Each generated test case includes:

1. **Title:** Clear, descriptive test case name
   - Example: `Verify user can login with valid credentials`

2. **Description (Summary):** Detailed information
   - Test Type (positive, negative, edge_case)
   - Severity (always "critical" for P1)
   - Test ID (TC_001, TC_002, etc.)
   - Detailed description of what's being tested
   - Preconditions (if applicable)

3. **Test Steps:** Step-by-step instructions
   - Each step has an action and expected result
   - Final step includes the overall expected outcome
   - Properly formatted in Azure DevOps XML format

4. **Links:** Automatically linked to parent work item
   - Visible in the "Related Work" section
   - Shows relationship in work item hierarchy

### Example Generated Test Case

**Title:** `TC_001: Verify login with valid credentials (positive scenario)`

**Description:**
```
Test Type: Positive
Severity: Critical
Test ID: TC_001

Description:
Verify that a registered user can successfully log in using valid 
credentials and access their account dashboard.

Preconditions:
- User account exists in the system
- User has valid credentials (username and password)
- Application is accessible
```

**Test Steps:**
```
1. Navigate to the login page
   Expected: Login page is displayed with username and password fields

2. Enter valid username in the username field
   Expected: Username is accepted and displayed

3. Enter valid password in the password field
   Expected: Password is masked and accepted

4. Click the "Login" button
   Expected: User is authenticated and redirected to dashboard

5. Verify user is logged in successfully
   Expected: Dashboard displays user's name and account information
```

## 🔍 Troubleshooting

### Issue 1: "Missing required environment variable"

**Error:**
```
ValueError: Missing required environment variable(s): ('WORK_ITEM_ID', 'ADO_WORK_ITEM_ID')
```

**Solution:**
```bash
# Make sure to set the work item ID
export WORK_ITEM_ID=4201189
```

### Issue 2: "Failed to fetch work item"

**Error:**
```
RuntimeError: GET failed 401 for https://dev.azure.com/...
```

**Solutions:**
1. Check your PAT is valid and not expired
2. Verify PAT has Work Items (Read) permission
3. Ensure organization and project names are correct

```bash
# Test your PAT manually
curl -u ":${SYSTEM_ACCESSTOKEN}" \
  "https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${WORK_ITEM_ID}?api-version=7.1"
```

### Issue 3: "Copilot CLI failed"

**Error:**
```
RuntimeError: Copilot CLI failed. Output: ...
```

**Solutions:**

**Option A: Install/Update GitHub CLI**
```bash
# macOS
brew install gh
brew upgrade gh

# Linux
curl -sS https://webi.sh/gh | sh
```

**Option B: Authenticate GitHub CLI**
```bash
gh auth login
gh extension install github/gh-copilot
```

**Option C: Provide GitHub Token**
```bash
export GH_TOKEN="your-github-token"
```

### Issue 4: "Could not parse org from SYSTEM_COLLECTIONURI"

**Error:**
```
ValueError: Could not parse org from SYSTEM_COLLECTIONURI=...
```

**Solution:**
```bash
# Set ADO_ORG explicitly
export ADO_ORG="vfuk-digital"
```

### Issue 5: "ADO_PROJECT is required to post test cases"

**Error:**
```
ERROR: ADO_PROJECT or SYSTEM_TEAMPROJECT is required to post test cases to Azure
```

**Solution:**
```bash
# Set the project name
export ADO_PROJECT="Digital"
```

### Issue 6: "Failed to create test case: 400"

**Error:**
```
RuntimeError: Failed to create test case: 400
```

**Possible Causes & Solutions:**

1. **Invalid project name**
   ```bash
   # Verify project exists
   curl -u ":${SYSTEM_ACCESSTOKEN}" \
     "https://dev.azure.com/${ADO_ORG}/_apis/projects?api-version=7.1"
   ```

2. **Insufficient permissions**
   - PAT needs **Work Items (Read & Write)** permission
   - Recreate PAT with correct permissions

3. **Special characters in test case data**
   - The script handles this automatically
   - If still failing, check logs for which test case failed

### Issue 7: No test cases generated

**Symptom:** Script completes but says "0 test cases"

**Solutions:**

1. **Check work item has content**
   ```bash
   # Work item must have description or acceptance criteria
   # View in Azure DevOps to verify
   ```

2. **Increase MAX_TEST_CASES**
   ```bash
   MAX_TEST_CASES=50 python userstory_testcase_generator.py
   ```

3. **Check Copilot response**
   - Look for JSON output in error messages
   - May need to retry due to AI variability

## 🔄 CI/CD Integration

### Azure DevOps Pipeline

Create `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: test-automation-secrets  # Contains GITHUB_TOKEN

steps:
  - task: UsePythonVersion@0
    displayName: 'Use Python 3.10'
    inputs:
      versionSpec: '3.10'

  - script: |
      pip install requests
    displayName: 'Install dependencies'

  - script: |
      # Install GitHub CLI
      curl -sS https://webi.sh/gh | sh
      export PATH="$HOME/.local/bin:$PATH"
      
      # Configure gh auth
      echo "$(GITHUB_TOKEN)" | gh auth login --with-token
      
      # Install Copilot extension
      gh extension install github/gh-copilot
    displayName: 'Setup GitHub Copilot CLI'
    env:
      GITHUB_TOKEN: $(GITHUB_TOKEN)

  - script: |
      python userstory_testcase_generator.py
    displayName: 'Generate test cases for work item'
    env:
      WORK_ITEM_ID: $(System.PullRequest.WorkItemId)
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      ADO_ORG: $(System.CollectionUri)
      ADO_PROJECT: $(System.TeamProject)
      GH_TOKEN: $(GITHUB_TOKEN)

  - task: PublishPipelineArtifact@1
    displayName: 'Publish test case mapping'
    inputs:
      targetPath: '$(System.DefaultWorkingDirectory)'
      artifact: 'test-case-mappings'
      publishLocation: 'pipeline'
    condition: succeededOrFailed()
```

### GitHub Actions

Create `.github/workflows/generate-test-cases.yml`:

```yaml
name: Generate Test Cases

on:
  workflow_dispatch:
    inputs:
      work_item_id:
        description: 'Azure DevOps Work Item ID'
        required: true
        type: string

jobs:
  generate:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: |
          pip install requests

      - name: Setup GitHub CLI with Copilot
        run: |
          # gh CLI is pre-installed on GitHub runners
          gh extension install github/gh-copilot
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate test cases
        run: |
          python userstory_testcase_generator.py
        env:
          WORK_ITEM_ID: ${{ github.event.inputs.work_item_id }}
          SYSTEM_ACCESSTOKEN: ${{ secrets.AZURE_DEVOPS_PAT }}
          ADO_ORG: ${{ secrets.ADO_ORG }}
          ADO_PROJECT: ${{ secrets.ADO_PROJECT }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: test-case-mappings
          path: test_cases_mapping_*.json
```

## 📊 Best Practices

### 1. Work Item Quality

For best results, ensure your work items have:

✅ **Clear Acceptance Criteria**
- Use bullet points or numbered lists
- Be specific about expected behavior
- Include both positive and negative scenarios

Example:
```
Acceptance Criteria:
- User can log in with valid email and password
- User cannot log in with invalid credentials
- Error message displayed for locked accounts
- Session persists for 24 hours after login
- User is redirected to dashboard after successful login
```

✅ **Detailed Description**
- Provide context and background
- Include business requirements
- Reference related work items or documentation

❌ **Avoid:**
- Vague or generic acceptance criteria
- Missing test scenarios
- Overly technical jargon without explanation

### 2. Review Generated Test Cases

After generation:

1. **Review in Azure DevOps:** Check test cases for accuracy
2. **Validate Coverage:** Ensure all acceptance criteria are covered
3. **Refine if Needed:** Edit test cases for clarity
4. **Add Tags:** Categorize for easy filtering

### 3. Batch Processing

For multiple work items, create a script:

```bash
#!/bin/bash

# List of work item IDs
WORK_ITEMS=(4201189 4201190 4201191)

for WORK_ITEM_ID in "${WORK_ITEMS[@]}"; do
  echo "Processing work item $WORK_ITEM_ID..."
  
  WORK_ITEM_ID=$WORK_ITEM_ID \
  SYSTEM_ACCESSTOKEN="$ADO_PAT" \
  ADO_ORG="vfuk-digital" \
  ADO_PROJECT="Digital" \
  python userstory_testcase_generator.py
  
  echo "Completed $WORK_ITEM_ID"
  echo "---"
done
```

### 4. Version Control

Track mapping files in git:

```bash
# Add to .gitignore if you don't want to commit
echo "test_cases_mapping_*.json" >> .gitignore

# Or commit for audit trail
git add test_cases_mapping_*.json
git commit -m "Test cases generated for US #4201189"
```

## 🎓 Understanding P1/Critical Filter

### Why Only Critical Severity?

The tool focuses on **P1/Critical** test cases to:
- ✅ Ensure essential functionality is thoroughly tested
- ✅ Avoid overwhelming QA teams with low-priority tests
- ✅ Focus on business-critical scenarios first
- ✅ Align with risk-based testing approach

### What Makes a Test Case P1/Critical?

The AI considers these factors:
- **Business Impact:** Affects core user workflows
- **Data Integrity:** Involves financial transactions or sensitive data
- **Security:** Related to authentication, authorization, or data protection
- **User Experience:** Blocks users from completing primary tasks
- **Acceptance Criteria:** Directly maps to stated requirements

### Examples of P1/Critical vs Lower Priority

**P1/Critical:**
- ✅ User authentication and login
- ✅ Payment processing
- ✅ Data validation for critical fields
- ✅ Error handling for system failures
- ✅ Core business logic

**Not P1 (Filtered Out):**
- ❌ UI color validation (unless accessibility requirement)
- ❌ Optional feature preferences
- ❌ Nice-to-have enhancements
- ❌ Non-critical edge cases

## 📞 Support and Resources

### Documentation
- **This Guide:** Complete usage instructions
- **Coding Guidelines:** `coding-guidelines-automation-testing.md`
- **PR Description:** `PR_DESCRIPTION.md`

### Common Resources
- **Azure DevOps REST API:** https://learn.microsoft.com/en-us/rest/api/azure/devops/
- **GitHub Copilot CLI:** https://docs.github.com/en/copilot/github-copilot-in-the-cli
- **Python requests library:** https://requests.readthedocs.io/

### Getting Help

1. **Check Troubleshooting Section:** Most common issues are documented above
2. **Review Error Messages:** They contain specific guidance
3. **Validate Environment:** Ensure all required variables are set
4. **Test Components:** Test Azure DevOps and GitHub access separately
5. **Create Issue:** If still stuck, create a ticket with:
   - Full error message
   - Environment variable values (redact tokens!)
   - Work item ID
   - Python version
   - Operating system

## 🔄 Updates and Maintenance

### Checking for Updates

```bash
# Check script version (look for version comment at top)
head -n 20 userstory_testcase_generator.py

# Pull latest changes
git pull origin main
```

### Dependency Updates

```bash
# Update Python packages
pip install --upgrade requests

# Update GitHub CLI
brew upgrade gh  # macOS
```

---

**Last Updated:** April 6, 2026  
**Version:** 1.0.0  
**Maintained by:** QA Automation Team

