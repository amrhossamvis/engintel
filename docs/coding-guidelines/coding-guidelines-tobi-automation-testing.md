# Automation Testing Coding Guidelines

This document consolidates the coding, testing, PR, and review standards for **automation testing frameworks** using Selenium, Appium, RestAssured, and Java. These guidelines ensure maintainable, scalable, and reliable test automation.

## 1. Purpose

These guidelines exist to:
- maintain consistent test automation code quality across teams,
- improve test readability, maintainability, and reusability,
- reduce test flakiness and unnecessary complexity,
- make test reviews faster and more accurate,
- support reliable test execution and faster feedback cycles,
- ensure proper separation of concerns using design patterns and OOP principles.

## 2. General Java Naming Conventions

Follow standard Java naming conventions throughout the test automation codebase.

### Test Classes
- Use **nouns** ending with appropriate suffixes.
- Use **PascalCase**.
- Suffix with test type identifier.

Examples:
- `LoginPageTest` (UI test)
- `UserRegistrationTest` (API test)
- `CheckoutFlowTest` (E2E test)
- `MobileSearchTest` (Mobile test)

### Page Objects and Screen Objects
- Use **nouns** ending with `Page` (Web) or `Screen` (Mobile).
- Use **PascalCase**.
- Name after the page/screen they represent.

Examples:
- `LoginPage`
- `ProductDetailsPage`
- `HomeScreen`
- `PaymentScreen`

### Step Definition Classes
- Use **descriptive nouns** ending with `Steps`.
- Use **PascalCase**.

Examples:
- `LoginSteps`
- `CheckoutSteps`
- `UserManagementSteps`

### API Client Classes
- Use **nouns** ending with `Client` or `Service`.
- Use **PascalCase**.

Examples:
- `UserApiClient`
- `OrderApiClient`
- `AuthenticationService`

### Methods
- Use **descriptive verbs** or **business action phrases**.
- Use **camelCase**.
- Test method names should be highly descriptive.

Examples:
- `enterUsername(String username)`
- `clickLoginButton()`
- `verifyWelcomeMessageIsDisplayed()`
- `testLoginWithValidCredentials()`
- `testProductSearchReturnsResults()`

### Variables
- Use **short but meaningful** names.
- Use **camelCase**.
- Avoid one-letter names except for temporary loop variables.

Examples:
- `username`
- `expectedErrorMessage`
- `actualResponseBody`
- `loginButton`
- `searchResults`

### Constants
- Use **UPPER_CASE_WITH_UNDERSCORES**.
- Define test data, timeouts, and configuration values as constants.

Examples:
- `DEFAULT_TIMEOUT_SECONDS`
- `MAX_RETRY_ATTEMPTS`
- `BASE_URL`
- `VALID_USERNAME`
- `API_ENDPOINT_USERS`

### Packages
- Use **all lowercase**.
- Organize by layer and feature.

Examples:
- `com.vf.automation.pages`
- `com.vf.automation.tests.ui`
- `com.vf.automation.tests.api`
- `com.vf.automation.steps`
- `com.vf.automation.utils`

## 3. Project Structure and Organization

### Recommended Directory Structure

```
src/
├── main/
│   └── java/
│       └── com/vf/automation/
│           ├── config/
│           │   ├── ConfigReader.java
│           │   └── DriverManager.java
│           ├── pages/              # Page Objects (Web)
│           │   ├── LoginPage.java
│           │   └── HomePage.java
│           ├── screens/            # Screen Objects (Mobile)
│           │   ├── LoginScreen.java
│           │   └── HomeScreen.java
│           ├── api/
│           │   ├── clients/        # API clients
│           │   │   ├── UserApiClient.java
│           │   │   └── OrderApiClient.java
│           │   ├── models/         # Request/Response POJOs
│           │   │   ├── UserRequest.java
│           │   │   └── UserResponse.java
│           │   └── specifications/ # RestAssured specs
│           │       └── RequestSpecifications.java
│           ├── steps/              # Step definitions (BDD)
│           │   ├── LoginSteps.java
│           │   └── CheckoutSteps.java
│           ├── utils/
│           │   ├── WaitHelper.java
│           │   ├── DateUtils.java
│           │   └── JsonUtils.java
│           └── constants/
│               ├── TestConstants.java
│               └── ApiEndpoints.java
└── test/
    ├── java/
    │   └── com/vf/automation/
    │       ├── tests/
    │       │   ├── ui/
    │       │   │   ├── LoginTest.java
    │       │   │   └── CheckoutTest.java
    │       │   ├── api/
    │       │   │   ├── UserApiTest.java
    │       │   │   └── OrderApiTest.java
    │       │   └── mobile/
    │       │       └── LoginMobileTest.java
    │       └── base/
    │           ├── BaseTest.java
    │           └── BaseApiTest.java
    └── resources/
        ├── config/
        │   ├── config.properties
        │   └── test-data.json
        ├── features/           # BDD feature files
        │   └── login.feature
        └── testng.xml         # TestNG suite files
```

## 4. Design Patterns and Principles

### Page Object Model (POM)
Use POM for all UI and mobile tests to separate test logic from page/screen structure.

**Benefits:**
- Reduces code duplication
- Improves maintainability
- Makes tests more readable
- Isolates UI changes to page objects

**Page Object Structure:**
```java
public class LoginPage {
    private WebDriver driver;
    
    // Locators as private fields
    private By usernameInput = By.id("username");
    private By passwordInput = By.id("password");
    private By loginButton = By.xpath("//button[@type='submit']");
    private By errorMessage = By.className("error-message");
    
    // Constructor
    public LoginPage(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }
    
    // Action methods
    public void enterUsername(String username) {
        driver.findElement(usernameInput).sendKeys(username);
    }
    
    public void enterPassword(String password) {
        driver.findElement(passwordInput).sendKeys(password);
    }
    
    public void clickLoginButton() {
        driver.findElement(loginButton).click();
    }
    
    // Combined actions (fluent interface)
    public HomePage loginWith(String username, String password) {
        enterUsername(username);
        enterPassword(password);
        clickLoginButton();
        return new HomePage(driver);
    }
    
    // Verification methods
    public boolean isErrorMessageDisplayed() {
        return driver.findElement(errorMessage).isDisplayed();
    }
    
    public String getErrorMessage() {
        return driver.findElement(errorMessage).getText();
    }
}
```

### Screen Object Model (Mobile)
Apply the same principles for mobile automation with Appium.

```java
public class LoginScreen {
    private AppiumDriver driver;
    
    @AndroidFindBy(id = "com.app:id/username")
    @iOSXCUITFindBy(id = "usernameField")
    private MobileElement usernameField;
    
    @AndroidFindBy(id = "com.app:id/password")
    @iOSXCUITFindBy(id = "passwordField")
    private MobileElement passwordField;
    
    @AndroidFindBy(xpath = "//android.widget.Button[@text='Login']")
    @iOSXCUITFindBy(accessibility = "loginButton")
    private MobileElement loginButton;
    
    public LoginScreen(AppiumDriver driver) {
        this.driver = driver;
        PageFactory.initElements(new AppiumFieldDecorator(driver), this);
    }
    
    public void enterCredentials(String username, String password) {
        usernameField.sendKeys(username);
        passwordField.sendKeys(password);
    }
    
    public HomeScreen login() {
        loginButton.click();
        return new HomeScreen(driver);
    }
}
```

### Factory Pattern
Use factory pattern for driver initialization and test data creation.

```java
public class DriverFactory {
    public static WebDriver createDriver(String browserType) {
        WebDriver driver;
        switch (browserType.toLowerCase()) {
            case "chrome":
                driver = new ChromeDriver();
                break;
            case "firefox":
                driver = new FirefoxDriver();
                break;
            case "edge":
                driver = new EdgeDriver();
                break;
            default:
                throw new IllegalArgumentException("Unsupported browser: " + browserType);
        }
        driver.manage().window().maximize();
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
        return driver;
    }
}
```

### Builder Pattern
Use builder pattern for complex test data and request objects.

```java
public class UserRequestBuilder {
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
    
    public UserRequestBuilder withUsername(String username) {
        this.username = username;
        return this;
    }
    
    public UserRequestBuilder withEmail(String email) {
        this.email = email;
        return this;
    }
    
    public UserRequestBuilder withFirstName(String firstName) {
        this.firstName = firstName;
        return this;
    }
    
    public UserRequestBuilder withLastName(String lastName) {
        this.lastName = lastName;
        return this;
    }
    
    public UserRequestBuilder withRole(String role) {
        this.role = role;
        return this;
    }
    
    public UserRequest build() {
        UserRequest request = new UserRequest();
        request.setUsername(username);
        request.setEmail(email);
        request.setFirstName(firstName);
        request.setLastName(lastName);
        request.setRole(role);
        return request;
    }
}
```

### Singleton Pattern
Use singleton for configuration and shared resources.

```java
public class ConfigReader {
    private static ConfigReader instance;
    private Properties properties;
    
    private ConfigReader() {
        properties = new Properties();
        try (InputStream input = getClass().getClassLoader()
                .getResourceAsStream("config/config.properties")) {
            properties.load(input);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load configuration", e);
        }
    }
    
    public static ConfigReader getInstance() {
        if (instance == null) {
            synchronized (ConfigReader.class) {
                if (instance == null) {
                    instance = new ConfigReader();
                }
            }
        }
        return instance;
    }
    
    public String getProperty(String key) {
        return properties.getProperty(key);
    }
}
```

## 5. Selenium Best Practices

### Locator Strategy Priority
Use locators in this order of preference:
1. **ID** - Most reliable and fastest
2. **Name** - Good for form elements
3. **CSS Selector** - Fast and powerful
4. **XPath** - Use when others aren't available

**Avoid:**
- Absolute XPath (brittle)
- Complex XPath with multiple levels
- Locators based on index positions

### Explicit Waits Over Implicit Waits
Use explicit waits (WebDriverWait) for better control and reliability.

```java
public class WaitHelper {
    private static final int DEFAULT_TIMEOUT = 10;
    
    public static void waitForElementVisible(WebDriver driver, By locator) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }
    
    public static void waitForElementClickable(WebDriver driver, By locator) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        wait.until(ExpectedConditions.elementToBeClickable(locator));
    }
    
    public static void waitForElementInvisible(WebDriver driver, By locator) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        wait.until(ExpectedConditions.invisibilityOfElementLocated(locator));
    }
    
    public static void waitForTextPresent(WebDriver driver, By locator, String text) {
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(DEFAULT_TIMEOUT));
        wait.until(ExpectedConditions.textToBePresentInElementLocated(locator, text));
    }
}
```

### Avoid Hard-Coded Sleeps
Do not use `Thread.sleep()`. Use explicit waits instead.

**Bad:**
```java
driver.findElement(loginButton).click();
Thread.sleep(3000); // Avoid this
```

**Good:**
```java
driver.findElement(loginButton).click();
WaitHelper.waitForElementVisible(driver, dashboardHeader);
```

### Handle Stale Element Exceptions
Implement retry logic for stale elements.

```java
public WebElement findElementWithRetry(By locator, int maxAttempts) {
    WebElement element = null;
    int attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            element = driver.findElement(locator);
            break;
        } catch (StaleElementReferenceException e) {
            attempts++;
            if (attempts >= maxAttempts) {
                throw e;
            }
        }
    }
    return element;
}
```

### JavaScript Executor Usage
Use JavaScriptExecutor sparingly and only when Selenium methods fail.

```java
public void scrollToElement(WebElement element) {
    JavascriptExecutor js = (JavascriptExecutor) driver;
    js.executeScript("arguments[0].scrollIntoView(true);", element);
}

public void clickUsingJS(WebElement element) {
    JavascriptExecutor js = (JavascriptExecutor) driver;
    js.executeScript("arguments[0].click();", element);
}
```

## 6. Appium Best Practices

### Platform-Specific Locators
Use `@AndroidFindBy` and `@iOSXCUITFindBy` for cross-platform support.

```java
@AndroidFindBy(id = "com.app:id/submit")
@iOSXCUITFindBy(accessibility = "submitButton")
private MobileElement submitButton;
```

### Mobile Gestures
Create reusable methods for mobile-specific gestures.

```java
public class GestureHelper {
    private AppiumDriver driver;
    
    public GestureHelper(AppiumDriver driver) {
        this.driver = driver;
    }
    
    public void swipeUp() {
        Dimension size = driver.manage().window().getSize();
        int startY = (int) (size.height * 0.80);
        int endY = (int) (size.height * 0.20);
        int startX = size.width / 2;
        
        new TouchAction(driver)
            .press(PointOption.point(startX, startY))
            .waitAction(WaitOptions.waitOptions(Duration.ofMillis(1000)))
            .moveTo(PointOption.point(startX, endY))
            .release()
            .perform();
    }
    
    public void swipeLeft(MobileElement element) {
        int startX = (int) (element.getLocation().getX() + element.getSize().getWidth() * 0.9);
        int endX = (int) (element.getLocation().getX() + element.getSize().getWidth() * 0.1);
        int y = element.getLocation().getY() + element.getSize().getHeight() / 2;
        
        new TouchAction(driver)
            .press(PointOption.point(startX, y))
            .waitAction(WaitOptions.waitOptions(Duration.ofMillis(500)))
            .moveTo(PointOption.point(endX, y))
            .release()
            .perform();
    }
    
    public void tapByCoordinates(int x, int y) {
        new TouchAction(driver)
            .tap(PointOption.point(x, y))
            .perform();
    }
}
```

### App State Management
Reset app state between tests when needed.

```java
@BeforeMethod
public void resetApp() {
    ((InteractsWithApps) driver).resetApp();
}
```

## 7. RestAssured Best Practices

### Request Specification Reusability
Create reusable request specifications.

```java
public class RequestSpecifications {
    public static RequestSpecification getBaseSpec() {
        return new RequestSpecBuilder()
            .setBaseUri(ConfigReader.getInstance().getProperty("api.base.url"))
            .setContentType(ContentType.JSON)
            .addHeader("Accept", "application/json")
            .setRelaxedHTTPSValidation()
            .build();
    }
    
    public static RequestSpecification getAuthSpec(String token) {
        return new RequestSpecBuilder()
            .addRequestSpecification(getBaseSpec())
            .addHeader("Authorization", "Bearer " + token)
            .build();
    }
}
```

### Response Specification Reusability
Create reusable response specifications.

```java
public class ResponseSpecifications {
    public static ResponseSpecification getSuccessSpec() {
        return new ResponseSpecBuilder()
            .expectStatusCode(200)
            .expectContentType(ContentType.JSON)
            .expectResponseTime(Matchers.lessThan(3000L))
            .build();
    }
    
    public static ResponseSpecification getCreatedSpec() {
        return new ResponseSpecBuilder()
            .expectStatusCode(201)
            .expectContentType(ContentType.JSON)
            .build();
    }
}
```

### API Client Pattern
Encapsulate API calls in client classes.

```java
public class UserApiClient {
    private static final String USERS_ENDPOINT = "/api/v1/users";
    
    public UserResponse createUser(UserRequest userRequest) {
        return given()
            .spec(RequestSpecifications.getAuthSpec(getToken()))
            .body(userRequest)
        .when()
            .post(USERS_ENDPOINT)
        .then()
            .spec(ResponseSpecifications.getCreatedSpec())
            .extract()
            .as(UserResponse.class);
    }
    
    public UserResponse getUserById(String userId) {
        return given()
            .spec(RequestSpecifications.getAuthSpec(getToken()))
            .pathParam("id", userId)
        .when()
            .get(USERS_ENDPOINT + "/{id}")
        .then()
            .spec(ResponseSpecifications.getSuccessSpec())
            .extract()
            .as(UserResponse.class);
    }
    
    public void deleteUser(String userId) {
        given()
            .spec(RequestSpecifications.getAuthSpec(getToken()))
            .pathParam("id", userId)
        .when()
            .delete(USERS_ENDPOINT + "/{id}")
        .then()
            .statusCode(204);
    }
    
    private String getToken() {
        // Token retrieval logic
        return ConfigReader.getInstance().getProperty("api.token");
    }
}
```

### Schema Validation
Validate response schemas against JSON schemas.

```java
@Test
public void testUserResponseSchema() {
    given()
        .spec(RequestSpecifications.getAuthSpec(token))
    .when()
        .get("/api/v1/users/123")
    .then()
        .assertThat()
        .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/user-schema.json"));
}
```

### Request and Response Logging
Enable logging for debugging.

```java
given()
    .spec(RequestSpecifications.getBaseSpec())
    .log().all()  // Log request
.when()
    .get("/api/v1/users")
.then()
    .log().all()  // Log response
    .statusCode(200);
```

## 8. Test Structure and Organization

### Test Class Structure
Follow consistent structure in test classes.

```java
public class LoginTest extends BaseTest {
    // Page objects or clients
    private LoginPage loginPage;
    private HomePage homePage;
    
    // Test data
    private static final String VALID_USERNAME = "testuser@example.com";
    private static final String VALID_PASSWORD = "Test@1234";
    private static final String INVALID_PASSWORD = "wrongpass";
    
    @BeforeMethod
    public void setUp() {
        // Initialize page objects
        loginPage = new LoginPage(driver);
        homePage = new HomePage(driver);
        
        // Navigate to start page
        driver.get(ConfigReader.getInstance().getProperty("app.url"));
    }
    
    @Test(description = "Verify user can login with valid credentials")
    public void testLoginWithValidCredentials() {
        // Arrange - prepare test data
        // (Already set up in test data constants)
        
        // Act - perform actions
        homePage = loginPage.loginWith(VALID_USERNAME, VALID_PASSWORD);
        
        // Assert - verify expected outcomes
        Assert.assertTrue(homePage.isWelcomeMessageDisplayed(), 
            "Welcome message should be displayed after successful login");
        Assert.assertEquals(homePage.getLoggedInUsername(), VALID_USERNAME,
            "Logged in username should match");
    }
    
    @Test(description = "Verify error message is displayed with invalid credentials")
    public void testLoginWithInvalidCredentials() {
        // Arrange
        String expectedErrorMessage = "Invalid username or password";
        
        // Act
        loginPage.loginWith(VALID_USERNAME, INVALID_PASSWORD);
        
        // Assert
        Assert.assertTrue(loginPage.isErrorMessageDisplayed(),
            "Error message should be displayed");
        Assert.assertEquals(loginPage.getErrorMessage(), expectedErrorMessage,
            "Error message text should match expected");
    }
    
    @AfterMethod
    public void tearDown() {
        // Cleanup actions if needed
    }
}
```

### API Test Structure
Structure API tests similarly.

```java
public class UserApiTest extends BaseApiTest {
    private UserApiClient userApiClient;
    private UserRequest testUserRequest;
    private String createdUserId;
    
    @BeforeClass
    public void setUpClass() {
        userApiClient = new UserApiClient();
    }
    
    @BeforeMethod
    public void setUp() {
        testUserRequest = new UserRequestBuilder()
            .withUsername("testuser_" + System.currentTimeMillis())
            .withEmail("test@example.com")
            .withFirstName("Test")
            .withLastName("User")
            .withRole("USER")
            .build();
    }
    
    @Test(description = "Verify user can be created successfully", priority = 1)
    public void testCreateUser() {
        // Act
        UserResponse response = userApiClient.createUser(testUserRequest);
        createdUserId = response.getId();
        
        // Assert
        Assert.assertNotNull(response.getId(), "User ID should not be null");
        Assert.assertEquals(response.getUsername(), testUserRequest.getUsername(),
            "Username should match request");
        Assert.assertEquals(response.getEmail(), testUserRequest.getEmail(),
            "Email should match request");
    }
    
    @Test(description = "Verify user can be retrieved by ID", priority = 2, 
          dependsOnMethods = "testCreateUser")
    public void testGetUserById() {
        // Act
        UserResponse response = userApiClient.getUserById(createdUserId);
        
        // Assert
        Assert.assertEquals(response.getId(), createdUserId,
            "Retrieved user ID should match");
        Assert.assertNotNull(response.getUsername(), "Username should not be null");
    }
    
    @AfterClass
    public void cleanUp() {
        // Clean up test data
        if (createdUserId != null) {
            userApiClient.deleteUser(createdUserId);
        }
    }
}
```

### Base Test Classes
Create base test classes for common setup and teardown.

```java
public class BaseTest {
    protected WebDriver driver;
    
    @BeforeMethod
    public void baseSetUp() {
        String browser = ConfigReader.getInstance().getProperty("browser");
        driver = DriverFactory.createDriver(browser);
        driver.manage().timeouts().implicitlyWait(
            Duration.ofSeconds(Integer.parseInt(
                ConfigReader.getInstance().getProperty("implicit.wait"))));
    }
    
    @AfterMethod
    public void baseTearDown() {
        if (driver != null) {
            driver.quit();
        }
    }
    
    protected void takeScreenshot(String testName) {
        File screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
        String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
        String filePath = "screenshots/" + testName + "_" + timestamp + ".png";
        try {
            FileUtils.copyFile(screenshot, new File(filePath));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
```

## 9. Test Naming Conventions

### Test Method Naming
Test method names should clearly describe what is being tested.

**Format:** `test[FeatureName]_[Scenario]_[ExpectedResult]`

Examples:
- `testLogin_WithValidCredentials_SuccessfullyLogsIn()`
- `testLogin_WithInvalidPassword_DisplaysErrorMessage()`
- `testProductSearch_WithValidKeyword_ReturnsMatchingResults()`
- `testCheckout_WithEmptyCart_DisplaysEmptyCartMessage()`
- `testCreateUser_WithValidData_ReturnsCreatedUser()`
- `testGetUser_WithInvalidId_Returns404NotFound()`

### BDD Feature and Scenario Naming
Use business-readable language in feature files.

```gherkin
Feature: User Login
  As a registered user
  I want to log in to the application
  So that I can access my account

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters valid username "testuser@example.com"
    And the user enters valid password "Test@1234"
    And the user clicks the login button
    Then the user should be redirected to the home page
    And the welcome message should be displayed

  Scenario Outline: Failed login with invalid credentials
    Given the user is on the login page
    When the user enters username "<username>"
    And the user enters password "<password>"
    And the user clicks the login button
    Then an error message "<errorMessage>" should be displayed

    Examples:
      | username              | password  | errorMessage                  |
      | invalid@example.com   | Test@1234 | Invalid username or password  |
      | testuser@example.com  | wrongpass | Invalid username or password  |
      |                       | Test@1234 | Username is required          |
      | testuser@example.com  |           | Password is required          |
```

## 10. Assertions and Validations

### Use Descriptive Assertion Messages
Always provide meaningful messages for assertions.

**Bad:**
```java
Assert.assertTrue(homePage.isWelcomeMessageDisplayed());
```

**Good:**
```java
Assert.assertTrue(homePage.isWelcomeMessageDisplayed(), 
    "Welcome message should be displayed after successful login");
```

### Soft Assertions
Use soft assertions when you want to collect multiple failures.

```java
@Test
public void testUserProfileDetails() {
    SoftAssert softAssert = new SoftAssert();
    
    UserProfile profile = homePage.getUserProfile();
    
    softAssert.assertNotNull(profile.getUsername(), "Username should not be null");
    softAssert.assertEquals(profile.getEmail(), "test@example.com", 
        "Email should match expected value");
    softAssert.assertTrue(profile.isActive(), "User should be active");
    softAssert.assertNotNull(profile.getCreatedDate(), "Created date should not be null");
    
    softAssert.assertAll(); // This will throw if any assertion failed
}
```

### API Response Assertions
Structure API response assertions clearly.

```java
@Test
public void testGetUserApiResponse() {
    // Act
    Response response = given()
        .spec(RequestSpecifications.getAuthSpec(token))
        .pathParam("id", userId)
    .when()
        .get("/api/v1/users/{id}");
    
    // Assert - Status and Headers
    Assert.assertEquals(response.getStatusCode(), 200, 
        "Status code should be 200");
    Assert.assertEquals(response.getContentType(), "application/json",
        "Content type should be JSON");
    
    // Assert - Response Body
    UserResponse userResponse = response.as(UserResponse.class);
    Assert.assertEquals(userResponse.getId(), userId, 
        "User ID should match");
    Assert.assertNotNull(userResponse.getUsername(), 
        "Username should not be null");
    Assert.assertTrue(userResponse.getEmail().contains("@"),
        "Email should be valid format");
    
    // Assert - Using RestAssured matchers
    response.then()
        .body("id", equalTo(userId))
        .body("username", notNullValue())
        .body("email", containsString("@"))
        .body("roles", hasSize(greaterThan(0)));
}
```

## 11. Test Data Management

### Externalize Test Data
Store test data in external files (properties, JSON, YAML, Excel).

**config.properties:**
```properties
# Application URLs
app.url=https://test.example.com
api.base.url=https://api.test.example.com

# Browser settings
browser=chrome
implicit.wait=10
explicit.wait=20

# Test credentials
test.user.email=testuser@example.com
test.user.password=Test@1234
```

**test-data.json:**
```json
{
  "validUsers": [
    {
      "username": "testuser1@example.com",
      "password": "Test@1234",
      "firstName": "Test",
      "lastName": "User One"
    }
  ],
  "invalidUsers": [
    {
      "username": "invalid@example.com",
      "password": "wrongpass",
      "expectedError": "Invalid username or password"
    }
  ]
}
```

### Data Providers
Use TestNG data providers for parameterized tests.

```java
@DataProvider(name = "loginCredentials")
public Object[][] getLoginCredentials() {
    return new Object[][] {
        {"validuser@example.com", "Test@1234", true},
        {"invaliduser@example.com", "wrongpass", false},
        {"", "Test@1234", false},
        {"testuser@example.com", "", false}
    };
}

@Test(dataProvider = "loginCredentials")
public void testLoginWithVariousCredentials(String username, String password, 
                                            boolean shouldSucceed) {
    loginPage.loginWith(username, password);
    
    if (shouldSucceed) {
        Assert.assertTrue(homePage.isWelcomeMessageDisplayed(),
            "Login should succeed with valid credentials");
    } else {
        Assert.assertTrue(loginPage.isErrorMessageDisplayed(),
            "Login should fail with invalid credentials");
    }
}
```

### Test Data Builders
Use builder pattern for complex test data.

```java
public class TestDataBuilder {
    public static UserRequest buildValidUserRequest() {
        return new UserRequestBuilder()
            .withUsername("testuser_" + System.currentTimeMillis())
            .withEmail("test" + System.currentTimeMillis() + "@example.com")
            .withFirstName("Test")
            .withLastName("User")
            .withRole("USER")
            .build();
    }
    
    public static UserRequest buildAdminUserRequest() {
        return new UserRequestBuilder()
            .withUsername("admin_" + System.currentTimeMillis())
            .withEmail("admin" + System.currentTimeMillis() + "@example.com")
            .withFirstName("Admin")
            .withLastName("User")
            .withRole("ADMIN")
            .build();
    }
}
```

## 12. Logging and Reporting

### Structured Logging
Use proper logging framework (Log4j2, SLF4J).

```java
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class LoginTest extends BaseTest {
    private static final Logger logger = LogManager.getLogger(LoginTest.class);
    
    @Test
    public void testLoginWithValidCredentials() {
        logger.info("Starting login test with valid credentials");
        
        logger.debug("Entering username: {}", VALID_USERNAME);
        loginPage.enterUsername(VALID_USERNAME);
        
        logger.debug("Entering password");
        loginPage.enterPassword(VALID_PASSWORD);
        
        logger.debug("Clicking login button");
        loginPage.clickLoginButton();
        
        logger.info("Verifying successful login");
        Assert.assertTrue(homePage.isWelcomeMessageDisplayed());
        
        logger.info("Login test completed successfully");
    }
}
```

### Screenshot on Failure
Capture screenshots automatically on test failure.

```java
public class TestListener implements ITestListener {
    @Override
    public void onTestFailure(ITestResult result) {
        Object testClass = result.getInstance();
        WebDriver driver = ((BaseTest) testClass).driver;
        
        if (driver != null) {
            String testName = result.getName();
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
            
            File screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
            String filePath = "screenshots/failed/" + testName + "_" + timestamp + ".png";
            
            try {
                FileUtils.copyFile(screenshot, new File(filePath));
                System.out.println("Screenshot saved: " + filePath);
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
}
```

### ExtentReports Integration
Integrate ExtentReports for comprehensive test reporting.

```java
public class ExtentManager {
    private static ExtentReports extent;
    private static ExtentTest test;
    
    public static ExtentReports getInstance() {
        if (extent == null) {
            String reportPath = "test-output/extent-report.html";
            ExtentSparkReporter sparkReporter = new ExtentSparkReporter(reportPath);
            sparkReporter.config().setDocumentTitle("Automation Test Report");
            sparkReporter.config().setReportName("Test Execution Report");
            sparkReporter.config().setTheme(Theme.STANDARD);
            
            extent = new ExtentReports();
            extent.attachReporter(sparkReporter);
            extent.setSystemInfo("OS", System.getProperty("os.name"));
            extent.setSystemInfo("Browser", ConfigReader.getInstance().getProperty("browser"));
        }
        return extent;
    }
    
    public static void createTest(String testName, String description) {
        test = extent.createTest(testName, description);
    }
    
    public static ExtentTest getTest() {
        return test;
    }
}
```

## 13. Error Handling and Recovery

### Exception Handling
Handle exceptions gracefully with meaningful error messages.

```java
public void clickElement(By locator) {
    try {
        WaitHelper.waitForElementClickable(driver, locator);
        driver.findElement(locator).click();
        logger.debug("Successfully clicked element: {}", locator);
    } catch (TimeoutException e) {
        logger.error("Element not clickable within timeout: {}", locator);
        throw new RuntimeException("Element not clickable: " + locator, e);
    } catch (ElementClickInterceptedException e) {
        logger.warn("Element click intercepted, trying JS click: {}", locator);
        clickUsingJS(driver.findElement(locator));
    } catch (Exception e) {
        logger.error("Unexpected error while clicking element: {}", locator, e);
        throw new RuntimeException("Failed to click element: " + locator, e);
    }
}
```

### Retry Mechanism
Implement retry logic for flaky tests.

```java
public class RetryAnalyzer implements IRetryAnalyzer {
    private int retryCount = 0;
    private static final int MAX_RETRY_COUNT = 2;
    
    @Override
    public boolean retry(ITestResult result) {
        if (retryCount < MAX_RETRY_COUNT) {
            retryCount++;
            System.out.println("Retrying test " + result.getName() + 
                             " for the " + retryCount + " time");
            return true;
        }
        return false;
    }
}

// Usage
@Test(retryAnalyzer = RetryAnalyzer.class)
public void testFlakySenario() {
    // Test implementation
}
```

## 14. Code Quality and Maintainability

### Follow SOLID Principles

**Single Responsibility:**
Each class should have one responsibility.

**Open/Closed:**
Classes should be open for extension but closed for modification.

**Liskov Substitution:**
Derived classes should be substitutable for their base classes.

**Interface Segregation:**
Many specific interfaces are better than one general interface.

**Dependency Inversion:**
Depend on abstractions, not concretions.

### Avoid Code Duplication
Extract common functionality into utility classes.

```java
public class WebElementHelper {
    public static void enterText(WebDriver driver, By locator, String text) {
        WaitHelper.waitForElementVisible(driver, locator);
        WebElement element = driver.findElement(locator);
        element.clear();
        element.sendKeys(text);
    }
    
    public static String getText(WebDriver driver, By locator) {
        WaitHelper.waitForElementVisible(driver, locator);
        return driver.findElement(locator).getText();
    }
    
    public static boolean isElementDisplayed(WebDriver driver, By locator) {
        try {
            return driver.findElement(locator).isDisplayed();
        } catch (NoSuchElementException e) {
            return false;
        }
    }
}
```

### Maintain Test Independence
Each test should be independent and able to run in any order.

**Bad:**
```java
@Test(priority = 1)
public void testCreateUser() {
    userId = userApiClient.createUser(userRequest).getId();
}

@Test(priority = 2, dependsOnMethods = "testCreateUser")
public void testUpdateUser() {
    userApiClient.updateUser(userId, updatedRequest); // Depends on previous test
}
```

**Good:**
```java
@BeforeMethod
public void setUp() {
    userId = userApiClient.createUser(userRequest).getId();
}

@Test
public void testUpdateUser() {
    userApiClient.updateUser(userId, updatedRequest);
}

@AfterMethod
public void tearDown() {
    userApiClient.deleteUser(userId);
}
```

### Keep Methods Small
Break down large methods into smaller, focused methods.

```java
// Bad - Large method doing too much
public void testCompleteCheckoutFlow() {
    driver.get(baseUrl);
    driver.findElement(By.id("username")).sendKeys("test");
    driver.findElement(By.id("password")).sendKeys("pass");
    driver.findElement(By.id("login")).click();
    driver.findElement(By.id("product1")).click();
    driver.findElement(By.id("addToCart")).click();
    driver.findElement(By.id("cart")).click();
    driver.findElement(By.id("checkout")).click();
    // ... many more lines
}

// Good - Broken into smaller methods
@Test
public void testCompleteCheckoutFlow() {
    loginAsUser("test", "pass");
    addProductToCart("product1");
    proceedToCheckout();
    enterShippingDetails(shippingInfo);
    enterPaymentDetails(paymentInfo);
    confirmOrder();
    verifyOrderConfirmation();
}
```

## 15. Parallel Execution

### TestNG Parallel Execution
Configure parallel execution in testng.xml.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE suite SYSTEM "https://testng.org/testng-1.0.dtd">
<suite name="Automation Test Suite" parallel="methods" thread-count="3">
    <test name="UI Tests">
        <classes>
            <class name="com.vf.automation.tests.ui.LoginTest"/>
            <class name="com.vf.automation.tests.ui.CheckoutTest"/>
        </classes>
    </test>
    
    <test name="API Tests">
        <classes>
            <class name="com.vf.automation.tests.api.UserApiTest"/>
            <class name="com.vf.automation.tests.api.OrderApiTest"/>
        </classes>
    </test>
</suite>
```

### Thread-Safe Driver Management
Use ThreadLocal for thread-safe driver instances.

```java
public class DriverManager {
    private static ThreadLocal<WebDriver> driver = new ThreadLocal<>();
    
    public static WebDriver getDriver() {
        return driver.get();
    }
    
    public static void setDriver(WebDriver driverInstance) {
        driver.set(driverInstance);
    }
    
    public static void quitDriver() {
        if (driver.get() != null) {
            driver.get().quit();
            driver.remove();
        }
    }
}

// Usage in BaseTest
@BeforeMethod
public void setUp() {
    WebDriver driver = DriverFactory.createDriver("chrome");
    DriverManager.setDriver(driver);
}

@AfterMethod
public void tearDown() {
    DriverManager.quitDriver();
}
```

## 16. Continuous Integration

### Maven Configuration
Configure Maven Surefire plugin for test execution.

```xml
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>3.0.0-M5</version>
            <configuration>
                <suiteXmlFiles>
                    <suiteXmlFile>testng.xml</suiteXmlFile>
                </suiteXmlFiles>
                <argLine>
                    -Dfile.encoding=UTF-8
                </argLine>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### CI/CD Pipeline Integration
Example Jenkins/GitLab CI configuration.

```yaml
# .gitlab-ci.yml
stages:
  - test

ui_tests:
  stage: test
  script:
    - mvn clean test -Dsuite=ui-tests
  artifacts:
    when: always
    reports:
      junit: target/surefire-reports/TEST-*.xml
    paths:
      - target/surefire-reports/
      - screenshots/

api_tests:
  stage: test
  script:
    - mvn clean test -Dsuite=api-tests
  artifacts:
    when: always
    reports:
      junit: target/surefire-reports/TEST-*.xml
```

## 17. Security and Credentials Management

### Never Hardcode Credentials
Use environment variables or secure vaults.

**Bad:**
```java
String username = "admin@example.com";
String password = "admin123";
```

**Good:**
```java
String username = System.getenv("TEST_USERNAME");
String password = System.getenv("TEST_PASSWORD");

// Or from config
String username = ConfigReader.getInstance().getProperty("test.user.email");
String password = ConfigReader.getInstance().getProperty("test.user.password");
```

### Mask Sensitive Data in Logs
Never log passwords or sensitive information.

```java
logger.info("Logging in with username: {}", username);
// Don't log: logger.info("Using password: {}", password);
logger.info("Logging in user");
```

## 18. Formatting and Readability

### Indentation
Use consistent indentation (4 spaces or 1 tab).

### Line Length
- Soft limit: **80 characters**
- Hard limit: **120 characters**

### Blank Lines
Use blank lines to separate logical sections within methods and between methods.

### Comments
- Add comments only where they clarify non-obvious logic.
- Keep comments up-to-date with code changes.
- Use JavaDoc for public methods and classes.

```java
/**
 * Logs in a user with provided credentials.
 * 
 * @param username the user's email address
 * @param password the user's password
 * @return HomePage instance if login is successful
 * @throws LoginException if login fails
 */
public HomePage loginWith(String username, String password) {
    enterUsername(username);
    enterPassword(password);
    clickLoginButton();
    return new HomePage(driver);
}
```

## 19. Commit and PR Standards

### Commit Messages
Use descriptive commit messages following this format:
- `[TestType][Feature] Short description`

Examples:
- `[UI][Login] Add tests for login with valid credentials`
- `[API][User] Implement user CRUD API tests`
- `[Mobile][Search] Add product search tests for Android`

### Pull Request Guidelines

**PR Title:**
- `[WorkItemType][WorkItemId] Descriptive PR title`

**PR Description Should Include:**
- What tests were added or modified
- Test coverage summary
- Any new dependencies or configurations
- Execution results (pass/fail count)
- Screenshots or videos for UI tests (if applicable)

### PR Checklist
Before merging:
- All tests pass locally
- Code follows naming conventions
- No hardcoded values or credentials
- Test data is externalized
- Proper logging is implemented
- Comments are meaningful
- No code duplication
- Screenshots on failure are enabled
- Test execution report is attached

## 20. Code Review Guidelines

Reviewers should assess:
- **Test Coverage:** Are positive, negative, and edge cases covered?
- **Code Organization:** Proper use of POM, page objects, and helper classes?
- **Naming Conventions:** Are names descriptive and consistent?
- **Wait Strategies:** No Thread.sleep(), proper explicit waits?
- **Assertions:** Are assertions meaningful with descriptive messages?
- **Test Independence:** Can tests run independently?
- **Code Duplication:** Is common code extracted to utilities?
- **Error Handling:** Are exceptions handled properly?
- **Logging:** Is logging appropriate and not excessive?
- **Test Data:** Is test data externalized and not hardcoded?
- **Documentation:** Are complex test scenarios documented?
- **Performance:** Are tests optimized (no unnecessary waits)?

## 21. Summary

Follow these guidelines to ensure:
- Maintainable and scalable test automation code
- Reduced test flakiness and false positives
- Faster test execution and feedback
- Easier collaboration and code reviews
- Reliable test results that provide confidence in releases

**Key Principles:**
- Write tests that are independent, repeatable, and reliable
- Keep code DRY (Don't Repeat Yourself)
- Use appropriate design patterns (POM, Factory, Builder, Singleton)
- Make tests readable - they serve as documentation
- Fail fast with meaningful error messages
- Continuously refactor and improve test code quality

