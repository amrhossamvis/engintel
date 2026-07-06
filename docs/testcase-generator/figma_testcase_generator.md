# Figma Design Test Case Generator - Usage Guide

## 📋 Overview

The Figma Design Test Case Generator is an AI-powered automation tool that analyzes Figma design files and automatically generates comprehensive P1/Critical UI/UX test cases, posting them directly to Azure DevOps as Test Case work items.

### Key Features
- ✅ **Figma Integration:** Fetches design specifications, frames, components, and comments
- ✅ **AI-Powered:** Uses GitHub Copilot CLI for intelligent UI/UX test case generation
- ✅ **Automatic Azure Integration:** Creates test cases and links them to user stories
- ✅ **P1/Critical Focus:** Generates only critical priority UI/UX test cases
- ✅ **Comprehensive UI Coverage:** Visual, functional, accessibility, and responsive tests
- ✅ **Rate Limit Handling:** Automatic retry logic for Figma API rate limits
- ✅ **Design Tracking:** Links test cases to Figma design files

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

3. **Figma Personal Access Token**
   - See "Setting Up Figma Access Token" section below

4. **GitHub Copilot CLI** (optional, will use gh CLI auth if not provided)
   ```bash
   # Install gh CLI
   brew install gh  # macOS
   
   # Login to GitHub
   gh auth login
   
   # Install Copilot extension
   gh extension install github/gh-copilot
   ```

5. **Azure DevOps Access**
   - Personal Access Token (PAT) with Work Items Read & Write permissions
   - Organization name
   - Project name

### Basic Usage

```bash
# Set environment variables
export FIGMA_URL='https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign'
export WORK_ITEM_ID=4201189  # Optional: link to user story
export FIGMA_TOKEN="figd_xxxxxxxxxxxxxxxx"
export SYSTEM_ACCESSTOKEN="your-azure-devops-pat-token"
export ADO_ORG="vfuk-digital"
export ADO_PROJECT="Digital"

# Run the generator
python figma_testcase_generator.py
```

### Expected Output

```
Extracting Figma file key from URL...
Figma File Key: ABC123DEF456

Fetching Figma file data...
Figma File: Mobile App Redesign
Found 8 frames/screens in design

Fetching linked work item #4201189...
Work Item: #4201189 [User Story] Mobile App UI Updates

Building test case generation prompt...
  NOTE: Generating ONLY P1/CRITICAL UI/UX test cases

Invoking GitHub Copilot CLI...
Generated 12 test cases from Copilot
Filtered to 12 CRITICAL (P1) test cases

Posting 12 critical test cases to Azure DevOps...
  Creating test case: TC_UI_001
  ✓ Created test case #4201200
  ✓ Linked test case #4201200 to work item #4201189
  [1/12] Posted: TC_UI_001
  ...

✓ Successfully posted 12 P1/CRITICAL UI/UX test cases to Azure DevOps
✓ Created test case IDs: [4201200, 4201201, 4201202, ...]
✓ Test case mapping saved to: figma_test_cases_mapping_ABC123DEF456.json

🔗 View test cases in Azure DevOps:
   https://dev.azure.com/vfuk-digital/Digital/_workitems/edit/4201189
```

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `FIGMA_URL` or `FIGMA_LINK` | Figma design file URL | `https://www.figma.com/file/ABC123/Design` |
| `FIGMA_TOKEN` or `FIGMA_ACCESS_TOKEN` | Figma Personal Access Token | `figd_xxxxxxxxxxxxxx` |
| `SYSTEM_ACCESSTOKEN` or `ADO_PAT` | Azure DevOps Personal Access Token | `your-pat-token` |
| `ADO_ORG` or `SYSTEM_COLLECTIONURI` | Azure DevOps organization name | `vfuk-digital` |
| `ADO_PROJECT` or `SYSTEM_TEAMPROJECT` | Azure DevOps project name | `Digital` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `WORK_ITEM_ID` or `ADO_WORK_ITEM_ID` | Azure DevOps work item to link test cases to | None | `4201189` |
| `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` | GitHub token for Copilot CLI | Uses `gh` CLI auth | `ghp_xxxx...` |
| `MAX_TEST_CASES` | Maximum number of test cases to generate | `20` | `30` |
| `MAX_WORK_ITEM_TEXT` | Maximum characters from work item | `1200000` | `500000` |

## 🎨 Setting Up Figma Access Token

### Step 1: Generate Figma Personal Access Token

1. **Log in to Figma:** https://www.figma.com/
2. **Open Settings:**
   - Click your profile picture (top right)
   - Select **Settings**
3. **Navigate to Personal Access Tokens:**
   - Scroll down to **Personal access tokens** section
   - Or go directly to: https://www.figma.com/settings (Account tab)
4. **Generate New Token:**
   - Click **Create new token** (or similar)
   - Enter a description: `Test Case Generator`
   - Click **Generate token**
5. **Copy Token Immediately:**
   - Token format: `figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Save it securely** - you won't see it again!

### Step 2: Set Environment Variable

```bash
# For current session
export FIGMA_TOKEN="figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# For permanent setup (add to ~/.bashrc or ~/.zshrc)
echo 'export FIGMA_TOKEN="figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Verify Access

```bash
# Test the token with a Figma file
curl -H "X-Figma-Token: ${FIGMA_TOKEN}" \
  "https://api.figma.com/v1/files/ABC123DEF456"
```

### Figma Token Permissions

The token has **read-only** access to:
- ✅ Files you own
- ✅ Files in teams you're a member of
- ✅ Files shared with you with "can view" or "can edit" access

❌ **Cannot access:**
- Private files you don't have access to
- Files in teams you're not a member of

## 📝 Detailed Usage Examples

### Example 1: Generate Test Cases from Figma Design Only

```bash
#!/bin/bash

# No work item linking - just create test cases
FIGMA_URL='https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign' \
FIGMA_TOKEN='figd_xxxxxxxxxxxxxxxx' \
SYSTEM_ACCESSTOKEN='ypqr4xxxxxxxxxxxxxxxxxx' \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python figma_testcase_generator.py
```

### Example 2: Link to Existing User Story

```bash
#!/bin/bash

# Generate test cases AND link them to a user story
FIGMA_URL='https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign' \
WORK_ITEM_ID=4201189 \
FIGMA_TOKEN='figd_xxxxxxxxxxxxxxxx' \
SYSTEM_ACCESSTOKEN='ypqr4xxxxxxxxxxxxxxxxxx' \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python figma_testcase_generator.py
```

### Example 3: Using Figma Design URLs

```bash
#!/bin/bash

# Both /file/ and /design/ URLs work
FIGMA_URL='https://www.figma.com/design/XYZ789/New-Feature' \
FIGMA_TOKEN='figd_xxxxxxxxxxxxxxxx' \
SYSTEM_ACCESSTOKEN='ypqr4xxxxxxxxxxxxxxxxxx' \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python figma_testcase_generator.py
```

### Example 4: Custom Test Case Limit

```bash
#!/bin/bash

# Generate more UI test cases
MAX_TEST_CASES=30 \
FIGMA_URL='https://www.figma.com/file/ABC123/Design' \
FIGMA_TOKEN='figd_xxxxxxxxxxxxxxxx' \
SYSTEM_ACCESSTOKEN='ypqr4xxxxxxxxxxxxxxxxxx' \
ADO_ORG=vfuk-digital \
ADO_PROJECT=Digital \
python figma_testcase_generator.py
```

### Example 5: Using in Azure Pipelines

```bash
#!/bin/bash

# SYSTEM variables are auto-provided in Azure Pipelines
FIGMA_URL='https://www.figma.com/file/ABC123/Design' \
WORK_ITEM_ID=4201189 \
FIGMA_TOKEN='figd_xxxxxxxxxxxxxxxx' \
python figma_testcase_generator.py

# Uses:
# - SYSTEM_ACCESSTOKEN (auto-provided by pipeline)
# - SYSTEM_COLLECTIONURI (auto-provided)
# - SYSTEM_TEAMPROJECT (auto-provided)
```

## 🔍 Understanding Figma File URLs

### Supported URL Formats

The script supports various Figma URL formats:

✅ **File URLs:**
```
https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign
https://www.figma.com/file/ABC123DEF456/Mobile%20App%20Redesign
```

✅ **Design URLs:**
```
https://www.figma.com/design/ABC123DEF456/New-Feature
```

✅ **With Query Parameters:**
```
https://www.figma.com/file/ABC123DEF456/Design?node-id=1%3A2
```

### Extracting File Key

The script extracts the **file key** from the URL:

```
https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign
                              ↑↑↑↑↑↑↑↑↑↑↑↑
                              File Key
```

This file key is used to fetch design data from the Figma API.

## 🎯 Understanding Generated UI/UX Test Cases

### Types of Test Cases Generated

The AI generates test cases covering:

1. **Visual Design Accuracy**
   - Layout and spacing validation
   - Color and typography verification
   - Component alignment and sizing
   - Visual consistency across screens

2. **Component Functionality**
   - Button interactions
   - Input field validation
   - Dropdown selections
   - Navigation flows

3. **User Interactions**
   - Click events
   - Form submissions
   - Navigation between screens
   - Gesture support (mobile)

4. **Responsive Design**
   - Different screen sizes
   - Orientation changes
   - Breakpoint validation
   - Mobile vs desktop layouts

5. **Accessibility**
   - Screen reader compatibility
   - Keyboard navigation
   - ARIA labels and roles
   - Color contrast ratios
   - Focus indicators

6. **Error States**
   - Validation messages
   - Error displays
   - Empty states
   - Loading states

### Example Generated Test Case

**Title:** `TC_UI_001: Verify login screen layout matches Figma design specifications`

**Description:**
```
Test Type: Visual
Severity: Critical

Description:
Verify that the login screen layout, component positioning, spacing, 
colors, and typography exactly match the Figma design specifications 
for the "Login Screen" frame.

Preconditions:
- Application is installed and accessible
- Test device/browser matches design breakpoint (375x812 for mobile)
- Design specifications available in Figma
```

**Test Steps:**
```
1. Navigate to the login screen
   Expected: Login screen is displayed

2. Verify the app logo is positioned at the top center with 24px top margin
   Expected: Logo matches Figma design position and spacing

3. Verify the username input field is positioned below the logo with proper spacing
   Expected: Input field matches Figma design (width, height, border, placeholder text)

4. Verify the password input field is positioned below username with 16px margin
   Expected: Password field matches design with proper masking icon

5. Verify the "Login" button matches design specifications
   Expected: Button has correct color (#FF6B00), border-radius (8px), and size

6. Verify the "Forgot Password?" link matches design
   Expected: Link is positioned correctly with proper text color and size

7. Verify overall screen layout matches Figma frame "Login Screen"
   Expected: All elements aligned and spaced according to Figma design
```

## 📦 Output Files

### Test Case Mapping File

After successful execution, a mapping file is created:

**Filename:** `figma_test_cases_mapping_{FILE_KEY}.json`

**Example:** `figma_test_cases_mapping_ABC123DEF456.json`

**Content:**
```json
{
  "figmaUrl": "https://www.figma.com/file/ABC123DEF456/Mobile-App-Redesign",
  "figmaFileName": "Mobile App Redesign",
  "workItemId": 4201189,
  "createdTestCaseIds": [
    4201200,
    4201201,
    4201202,
    4201203,
    4201204
  ],
  "testCaseCount": 5,
  "severity": "critical",
  "timestamp": "2026-04-06T14:30:45.123456"
}
```

**Use Cases:**
- Track which test cases were created for a Figma design
- Link between Figma designs and Azure DevOps test cases
- Audit trail for UI/UX test case generation
- Bulk operations on generated test cases

## 🎨 Best Practices for Figma Designs

### 1. Organize Your Figma File

For best test case generation:

✅ **Use Clear Frame Names**
```
✓ "Login Screen - Mobile"
✓ "Dashboard - Desktop View"
✓ "Error State - Invalid Input"

✗ "Frame 1"
✗ "Copy of Rectangle"
```

✅ **Add Component Descriptions**
- Use Figma's description field for components
- Explain interactive behavior
- Note validation rules

✅ **Use Comments for Specifications**
- Add comments for complex interactions
- Specify expected behavior
- Note accessibility requirements

✅ **Group Related Elements**
- Use frames for logical sections
- Name groups descriptively
- Show component hierarchy

### 2. Design File Structure

**Recommended Structure:**
```
📁 Mobile App Redesign
├── 📱 Screens
│   ├── 🖼️ Login Screen
│   ├── 🖼️ Home Screen
│   ├── 🖼️ Profile Screen
│   └── 🖼️ Settings Screen
├── 🧩 Components
│   ├── 🔘 Buttons
│   ├── 📝 Input Fields
│   └── 🎯 Icons
├── 🎨 Styles
│   ├── Colors
│   └── Typography
└── 📐 Specs
    ├── Spacing Guide
    └── Responsive Breakpoints
```

### 3. Add Design Annotations

Use Figma comments to add:
- Interaction details
- Validation rules
- Accessibility requirements
- Responsive behavior notes
- Animation specifications

**Example Comment:**
```
"Login Button:
- Click triggers authentication
- Shows loading spinner during API call
- Disabled state if fields are empty
- Error state shows below button
- Success redirects to dashboard"
```

## 🔍 Troubleshooting

### Issue 1: "Could not extract Figma file key from URL"

**Error:**
```
ValueError: Could not extract Figma file key from URL: https://...
```

**Solutions:**

1. **Check URL Format:**
   ```bash
   # Correct formats:
   https://www.figma.com/file/ABC123/Design-Name
   https://www.figma.com/design/ABC123/Design-Name
   
   # Extract just the file portion if URL has extra parameters
   ```

2. **Remove Query Parameters Carefully:**
   ```bash
   # Full URL
   FIGMA_URL='https://www.figma.com/file/ABC123/Design?node-id=1:2&mode=dev'
   # Script handles this automatically
   ```

### Issue 2: Figma API Rate Limit Hit

**Symptom:**
```
⏳ Figma API rate limit hit. Waiting 60 seconds (retry 2/4)...
   This is normal - Figma has strict rate limits. Please wait...
```

**What's Happening:**
- Figma API: 30 requests per minute per token
- Script automatically retries with exponential backoff
- Wait times: 60s, 120s, 180s

**Solutions:**

1. **Just Wait:** Script handles this automatically
2. **Avoid Rapid Repeated Runs:** Space out executions
3. **Use Different Token:** If processing multiple files

**This is NORMAL and expected behavior!**

### Issue 3: "Figma API failed 403"

**Error:**
```
RuntimeError: Figma API failed 403: {"status":403,"err":"Forbidden"}
```

**Solutions:**

1. **Check Token Validity:**
   ```bash
   # Test token manually
   curl -H "X-Figma-Token: ${FIGMA_TOKEN}" \
     "https://api.figma.com/v1/me"
   ```

2. **Verify File Access:**
   - Ensure you have access to the file
   - File must be in a team you're a member of
   - Or file must be shared with you

3. **Regenerate Token:**
   - Token may have been revoked
   - Create a new token in Figma settings

### Issue 4: "Figma API failed 404"

**Error:**
```
RuntimeError: Figma API failed 404: {"status":404,"err":"Not found"}
```

**Solutions:**

1. **Check File Key:**
   ```bash
   # Extract file key from URL manually
   # URL: https://www.figma.com/file/ABC123/Design
   # Key: ABC123
   ```

2. **Verify File Exists:**
   - Open URL in browser
   - Ensure file hasn't been deleted
   - Check if file was moved

3. **Check File Sharing:**
   - File might be private
   - Request access from owner

### Issue 5: "No frames found in design"

**Symptom:**
```
Found 0 frames/screens in design
```

**Solutions:**

1. **Check Figma File Structure:**
   - Ensure file has frames (not just components)
   - Frames should be at top level or one level deep

2. **Use Canvas Frames:**
   - Select **Frame** tool (F)
   - Create frames for each screen
   - Name frames descriptively

3. **Avoid Deep Nesting:**
   - Script limits to 5 levels deep
   - Flatten structure if too nested

### Issue 6: "Warning: Could not fetch comments"

**Symptom:**
```
Warning: Could not fetch comments: 403
```

**Impact:** Non-critical - test cases will still be generated

**Solution:**
- Comments are optional
- Ensure token has proper permissions
- Some files may restrict comment access

### Issue 7: No Work Item Provided

**Prompt:**
```
WARNING: No work item ID provided. Test cases will be created but not linked to a user story.
To link test cases, provide WORK_ITEM_ID environment variable.
Continue without linking? (y/n):
```

**Options:**

1. **Continue Without Linking:**
   ```bash
   # Press 'y' to create test cases without parent link
   y
   ```

2. **Cancel and Add Work Item:**
   ```bash
   # Press 'n', then re-run with WORK_ITEM_ID
   n
   
   # Re-run with work item
   WORK_ITEM_ID=4201189 FIGMA_URL='...' python figma_testcase_generator.py
   ```

## 🔄 CI/CD Integration

### Azure DevOps Pipeline

Create `azure-pipelines-figma.yml`:

```yaml
trigger:
  branches:
    include:
      - main
      - feature/*

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: test-automation-secrets  # Contains FIGMA_TOKEN, GITHUB_TOKEN

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
      python figma_testcase_generator.py
    displayName: 'Generate test cases from Figma design'
    env:
      FIGMA_URL: $(FIGMA_DESIGN_URL)
      WORK_ITEM_ID: $(System.PullRequest.WorkItemId)
      FIGMA_TOKEN: $(FIGMA_TOKEN)
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      ADO_ORG: $(System.CollectionUri)
      ADO_PROJECT: $(System.TeamProject)
      GH_TOKEN: $(GITHUB_TOKEN)

  - task: PublishPipelineArtifact@1
    displayName: 'Publish test case mapping'
    inputs:
      targetPath: '$(System.DefaultWorkingDirectory)'
      artifact: 'figma-test-case-mappings'
      publishLocation: 'pipeline'
    condition: succeededOrFailed()
```

### GitHub Actions

Create `.github/workflows/generate-figma-tests.yml`:

```yaml
name: Generate Figma Test Cases

on:
  workflow_dispatch:
    inputs:
      figma_url:
        description: 'Figma Design File URL'
        required: true
        type: string
      work_item_id:
        description: 'Azure DevOps Work Item ID (optional)'
        required: false
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
          gh extension install github/gh-copilot
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Generate test cases from Figma
        run: |
          python figma_testcase_generator.py
        env:
          FIGMA_URL: ${{ github.event.inputs.figma_url }}
          WORK_ITEM_ID: ${{ github.event.inputs.work_item_id }}
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
          SYSTEM_ACCESSTOKEN: ${{ secrets.AZURE_DEVOPS_PAT }}
          ADO_ORG: ${{ secrets.ADO_ORG }}
          ADO_PROJECT: ${{ secrets.ADO_PROJECT }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: figma-test-case-mappings
          path: figma_test_cases_mapping_*.json
```

## 📊 Advanced Use Cases

### Use Case 1: Design Review Automation

```bash
#!/bin/bash
# Run after design reviews to ensure test coverage

FIGMA_DESIGNS=(
  "https://www.figma.com/file/ABC123/Login-Flow"
  "https://www.figma.com/file/DEF456/Checkout-Process"
  "https://www.figma.com/file/GHI789/User-Profile"
)

for DESIGN in "${FIGMA_DESIGNS[@]}"; do
  echo "Processing design: $DESIGN"
  
  FIGMA_URL="$DESIGN" \
  FIGMA_TOKEN="$FIGMA_TOKEN" \
  SYSTEM_ACCESSTOKEN="$ADO_PAT" \
  ADO_ORG="vfuk-digital" \
  ADO_PROJECT="Digital" \
  python figma_testcase_generator.py
  
  echo "---"
done
```

### Use Case 2: Sprint Planning Integration

```bash
#!/bin/bash
# Generate test cases for all user stories with Figma designs

# Read from Azure DevOps query or file
USER_STORIES=(
  "4201189|https://www.figma.com/file/ABC/Login"
  "4201190|https://www.figma.com/file/DEF/Dashboard"
)

for STORY in "${USER_STORIES[@]}"; do
  IFS='|' read -r WORK_ITEM FIGMA_URL <<< "$STORY"
  
  echo "Processing Story #$WORK_ITEM with design $FIGMA_URL"
  
  WORK_ITEM_ID="$WORK_ITEM" \
  FIGMA_URL="$FIGMA_URL" \
  FIGMA_TOKEN="$FIGMA_TOKEN" \
  SYSTEM_ACCESSTOKEN="$ADO_PAT" \
  ADO_ORG="vfuk-digital" \
  ADO_PROJECT="Digital" \
  python figma_testcase_generator.py
done
```

### Use Case 3: Regression Test Suite Updates

```bash
#!/bin/bash
# Update test cases when designs change

FIGMA_URL="https://www.figma.com/file/ABC123/Updated-Design"
ORIGINAL_WORK_ITEM=4201189

# Generate new test cases
FIGMA_URL="$FIGMA_URL" \
WORK_ITEM_ID="$ORIGINAL_WORK_ITEM" \
FIGMA_TOKEN="$FIGMA_TOKEN" \
SYSTEM_ACCESSTOKEN="$ADO_PAT" \
ADO_ORG="vfuk-digital" \
ADO_PROJECT="Digital" \
python figma_testcase_generator.py

# Review and compare with existing test cases
echo "Review new test cases and update regression suite"
```

## 🎓 Understanding P1/Critical UI/UX Tests

### What Makes a UI Test P1/Critical?

The AI considers:

**Visual Accuracy (P1):**
- ✅ Core brand elements (logo, colors)
- ✅ Critical information display
- ✅ Payment/transaction screens
- ✅ Error messages and alerts

**Functional (P1):**
- ✅ Primary navigation
- ✅ Form submissions
- ✅ Critical user actions
- ✅ Authentication flows

**Accessibility (P1):**
- ✅ Keyboard navigation for critical paths
- ✅ Screen reader compatibility
- ✅ WCAG AA compliance for critical content
- ✅ Focus indicators

**Responsive (P1):**
- ✅ Mobile vs desktop critical differences
- ✅ Breakpoint functionality
- ✅ Touch target sizes

### Examples

**P1/Critical:**
- ✅ Login screen layout and functionality
- ✅ Payment form validation
- ✅ Navigation menu accessibility
- ✅ Error message display
- ✅ Primary CTA button styling

**Not P1:**
- ❌ Icon color variants
- ❌ Tooltip animations
- ❌ Optional preference settings UI
- ❌ Marketing banner layouts

## 📞 Support and Resources

### Documentation
- **This Guide:** Figma generator usage instructions
- **User Story Guide:** `USAGE_USER_STORY_GENERATOR.md`
- **Coding Guidelines:** `coding-guidelines-automation-testing.md`
- **PR Description:** `PR_DESCRIPTION.md`

### External Resources
- **Figma API Documentation:** https://www.figma.com/developers/api
- **Figma REST API Reference:** https://www.figma.com/developers/api#files
- **Azure DevOps REST API:** https://learn.microsoft.com/en-us/rest/api/azure/devops/
- **GitHub Copilot CLI:** https://docs.github.com/en/copilot/github-copilot-in-the-cli

### Getting Help

1. **Check Troubleshooting Section:** Common issues documented
2. **Verify Figma Access:** Test token and file access separately
3. **Validate Environment:** Ensure all variables set correctly
4. **Review Figma File Structure:** Ensure frames are properly organized
5. **Create Issue:** Include:
   - Full error message
   - Figma file key (not full URL to avoid sharing private designs)
   - Environment details
   - Screenshot of error

## 🔄 Updates and Maintenance

### Rate Limit Monitoring

The script handles Figma rate limits automatically:

```
Figma API Rate Limits:
- 30 requests per minute per token
- Automatic retry with backoff: 60s, 120s, 180s
- No action needed - just wait when prompted
```

### Figma API Changes

Monitor Figma API changelog:
- https://www.figma.com/developers/api#changelog

Update script if API changes affect:
- File structure format
- Comment endpoints
- Authentication methods

---

**Last Updated:** April 6, 2026  
**Version:** 1.0.0  
**Maintained by:** QA Automation Team

