document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const registrationModal = document.getElementById("registration-modal");
  const modalActivityName = document.getElementById("modal-activity-name");
  const signupForm = document.getElementById("signup-form");
  const activityInput = document.getElementById("activity");
  const closeRegistrationModal = document.querySelector(".close-modal");

  // Search and filter elements
  const searchInput = document.getElementById("activity-search");
  const searchButton = document.getElementById("search-button");
  const categoryFilters = document.querySelectorAll(".category-filter");
  const dayFilters = document.querySelectorAll(".day-filter");
  const timeFilters = document.querySelectorAll(".time-filter");

  // Authentication elements
  const loginButton = document.getElementById("login-button");
  const userInfo = document.getElementById("user-info");
  const displayName = document.getElementById("display-name");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeLoginModal = document.querySelector(".close-login-modal");
  const loginMessage = document.getElementById("login-message");

  // Activity categories with corresponding colors
  const activityTypes = {
    sports: { label: "Sports", color: "#e8f5e9", textColor: "#2e7d32" },
    arts: { label: "Arts", color: "#f3e5f5", textColor: "#7b1fa2" },
    academic: { label: "Academic", color: "#e3f2fd", textColor: "#1565c0" },
    community: { label: "Community", color: "#fff3e0", textColor: "#e65100" },
    technology: { label: "Technology", color: "#e8eaf6", textColor: "#3949ab" },
  };

  // State for activities and filters
  let allActivities = {};
  let currentFilter = "all";
  let searchQuery = "";
  let currentDay = "";
  let currentTimeRange = "";

  // Authentication state
  let currentUser = null;

  // Time range mappings for the dropdown
  const timeRanges = {
    morning: { start: "06:00", end: "08:00" }, // Before school hours
    afternoon: { start: "15:00", end: "18:00" }, // After school hours
    weekend: { days: ["Saturday", "Sunday"] }, // Weekend days
  };

  // Initialize filters from active elements
  function initializeFilters() {
    // Initialize day filter
    const activeDayFilter = document.querySelector(".day-filter.active");
    if (activeDayFilter) {
      currentDay = activeDayFilter.dataset.day;
    }

    // Initialize time filter
    const activeTimeFilter = document.querySelector(".time-filter.active");
    if (activeTimeFilter) {
      currentTimeRange = activeTimeFilter.dataset.time;
    }
  }

  // Function to set day filter
  function setDayFilter(day) {
    currentDay = day;

    // Update active class
    dayFilters.forEach((btn) => {
      if (btn.dataset.day === day) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Function to set time range filter
  function setTimeRangeFilter(timeRange) {
    currentTimeRange = timeRange;

    // Update active class
    timeFilters.forEach((btn) => {
      if (btn.dataset.time === timeRange) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    fetchActivities();
  }

  // Check if user is already logged in (from localStorage)
  function checkAuthentication() {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
        // Verify the stored user with the server
        validateUserSession(currentUser.username);
      } catch (error) {
        console.error("Error parsing saved user", error);
        logout(); // Clear invalid data
      }
    }

    // Set authentication class on body
    updateAuthBodyClass();
  }

  // Validate user session with the server
  async function validateUserSession(username) {
    try {
      const response = await fetch(
        `/auth/check-session?username=${encodeURIComponent(username)}`
      );

      if (!response.ok) {
        // Session invalid, log out
        logout();
        return;
      }

      // Session is valid, update user data
      const userData = await response.json();
      currentUser = userData;
      localStorage.setItem("currentUser", JSON.stringify(userData));
      updateAuthUI();
    } catch (error) {
      console.error("Error validating session:", error);
    }
  }

  // Update UI based on authentication state
  function updateAuthUI() {
    if (currentUser) {
      loginButton.classList.add("hidden");
      userInfo.classList.remove("hidden");
      displayName.textContent = currentUser.display_name;
    } else {
      loginButton.classList.remove("hidden");
      userInfo.classList.add("hidden");
      displayName.textContent = "";
    }

    updateAuthBodyClass();
    // Refresh the activities to update the UI
    fetchActivities();
  }

  // Update body class for CSS targeting
  function updateAuthBodyClass() {
    if (currentUser) {
      document.body.classList.remove("not-authenticated");
    } else {
      document.body.classList.add("not-authenticated");
    }
  }

  // Login function
  async function login(username, password) {
    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(
          username
        )}&password=${encodeURIComponent(password)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        showLoginMessage(
          data.detail || "Invalid username or password",
          "error"
        );
        return false;
      }

      // Login successful
      currentUser = data;
      localStorage.setItem("currentUser", JSON.stringify(data));
      updateAuthUI();
      closeLoginModalHandler();
      showMessage(`Welcome, ${currentUser.display_name}!`, "success");
      return true;
    } catch (error) {
      console.error("Error during login:", error);
      showLoginMessage("Login failed. Please try again.", "error");
      return false;
    }
  }

  // Logout function
  function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateAuthUI();
    showMessage("You have been logged out.", "info");
  }

  // Show message in login modal
  function showLoginMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.className = `message ${type}`;
    loginMessage.classList.remove("hidden");
  }

  // Open login modal
  function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.classList.add("show");
    loginMessage.classList.add("hidden");
    loginForm.reset();
  }

  // Close login modal
  function closeLoginModalHandler() {
    loginModal.classList.remove("show");
    setTimeout(() => {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }, 300);
  }

  // Event listeners for authentication
  loginButton.addEventListener("click", openLoginModal);
  logoutButton.addEventListener("click", logout);
  closeLoginModal.addEventListener("click", closeLoginModalHandler);

  // Close login modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModalHandler();
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    await login(username, password);
  });

  // Show loading skeletons
  function showLoadingSkeletons() {
    activitiesList.innerHTML = "";

    // Create more skeleton cards to fill the screen since they're smaller now
    for (let i = 0; i < 9; i++) {
      const skeletonCard = document.createElement("div");
      skeletonCard.className = "skeleton-card";
      skeletonCard.innerHTML = `
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-text short"></div>
        <div style="margin-top: 8px;">
          <div class="skeleton-line" style="height: 6px;"></div>
          <div class="skeleton-line skeleton-text short" style="height: 8px; margin-top: 3px;"></div>
        </div>
        <div style="margin-top: auto;">
          <div class="skeleton-line" style="height: 24px; margin-top: 8px;"></div>
        </div>
      `;
      activitiesList.appendChild(skeletonCard);
    }
  }

  // Format schedule for display - handles both old and new format
  function formatSchedule(details) {
    // If schedule_details is available, use the structured data
    if (details.schedule_details) {
      const days = details.schedule_details.days.join(", ");

      // Convert 24h time format to 12h AM/PM format for display
      const formatTime = (time24) => {
        const [hours, minutes] = time24.split(":").map((num) => parseInt(num));
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
        return `${displayHours}:${minutes
          .toString()
          .padStart(2, "0")} ${period}`;
      };

      const startTime = formatTime(details.schedule_details.start_time);
      const endTime = details.schedule_details.end_time
        ? ` - ${formatTime(details.schedule_details.end_time)}`
        : "";

      return `${days}, ${startTime}${endTime}`;
    }

    // Fallback to the string format if schedule_details isn't available
    return details.schedule;
  }

  // Function to determine activity type (this would ideally come from backend)
  function getActivityType(activityName, description) {
    const name = activityName.toLowerCase();
    const desc = description.toLowerCase();

    if (
      name.includes("soccer") ||
      name.includes("basketball") ||
      name.includes("sport") ||
      name.includes("fitness") ||
      desc.includes("team") ||
      desc.includes("game") ||
      desc.includes("athletic")
    ) {
      return "sports";
    } else if (
      name.includes("art") ||
      name.includes("music") ||
      name.includes("theater") ||
      name.includes("drama") ||
      desc.includes("creative") ||
      desc.includes("paint")
    ) {
      return "arts";
    } else if (
      name.includes("science") ||
      name.includes("math") ||
      name.includes("academic") ||
      name.includes("study") ||
      name.includes("olympiad") ||
      desc.includes("learning") ||
      desc.includes("education") ||
      desc.includes("competition")
    ) {
      return "academic";
    } else if (
      name.includes("volunteer") ||
      name.includes("community") ||
      desc.includes("service") ||
      desc.includes("volunteer")
    ) {
      return "community";
    } else if (
      name.includes("computer") ||
      name.includes("coding") ||
      name.includes("tech") ||
      name.includes("robotics") ||
      desc.includes("programming") ||
      desc.includes("technology") ||
      desc.includes("digital") ||
      desc.includes("robot")
    ) {
      return "technology";
    }

    // Default to "academic" if no match
    return "academic";
  }

  // Function to fetch activities from API with optional day and time filters
  async function fetchActivities() {
    // Show loading skeletons first
    showLoadingSkeletons();

    try {
      // Build query string with filters if they exist
      let queryParams = [];

      // Handle day filter
      if (currentDay) {
        queryParams.push(`day=${encodeURIComponent(currentDay)}`);
      }

      // Handle time range filter
      if (currentTimeRange) {
        const range = timeRanges[currentTimeRange];

        // Handle weekend special case
        if (currentTimeRange === "weekend") {
          // Don't add time parameters for weekend filter
          // Weekend filtering will be handled on the client side
        } else if (range) {
          // Add time parameters for before/after school
          queryParams.push(`start_time=${encodeURIComponent(range.start)}`);
          queryParams.push(`end_time=${encodeURIComponent(range.end)}`);
        }
      }

      const queryString =
        queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
      const response = await fetch(`/activities${queryString}`);
      const activities = await response.json();

      // Save the activities data
      allActivities = activities;

      // Apply search and filter, and handle weekend filter in client
      displayFilteredActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Function to display filtered activities
  function displayFilteredActivities() {
    // Clear the activities list
    activitiesList.innerHTML = "";

    // Apply client-side filtering - this handles category filter and search, plus weekend filter
    let filteredActivities = {};

    Object.entries(allActivities).forEach(([name, details]) => {
      const activityType = getActivityType(name, details.description);

      // Apply category filter
      if (currentFilter !== "all" && activityType !== currentFilter) {
        return;
      }

      // Apply weekend filter if selected
      if (currentTimeRange === "weekend" && details.schedule_details) {
        const activityDays = details.schedule_details.days;
        const isWeekendActivity = activityDays.some((day) =>
          timeRanges.weekend.days.includes(day)
        );

        if (!isWeekendActivity) {
          return;
        }
      }

      // Apply search filter
      const searchableContent = [
        name.toLowerCase(),
        details.description.toLowerCase(),
        formatSchedule(details).toLowerCase(),
      ].join(" ");

      if (
        searchQuery &&
        !searchableContent.includes(searchQuery.toLowerCase())
      ) {
        return;
      }

      // Activity passed all filters, add to filtered list
      filteredActivities[name] = details;
    });

    // Check if there are any results
    if (Object.keys(filteredActivities).length === 0) {
      activitiesList.innerHTML = `
        <div class="no-results">
          <h4>No activities found</h4>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      `;
      return;
    }

    // Display filtered activities
    Object.entries(filteredActivities).forEach(([name, details]) => {
      renderActivityCard(name, details);
    });

    // Check if URL has a specific activity to highlight
    highlightActivityFromUrl();
  }

  // Helper function to build a shareable link for an activity
  function getActivityShareUrl(name) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("activity", name);
      return url.toString();
    } catch (e) {
      return `${window.location.origin}${window.location.pathname}?activity=${encodeURIComponent(name)}`;
    }
  }

  // Helper function to copy text to clipboard with fallback
  async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // Fallback below
      }
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }

  // Helper function to scroll and highlight an activity linked from URL
  function highlightActivityFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let targetActivity = urlParams.get("activity");
    if (!targetActivity && window.location.hash) {
      targetActivity = decodeURIComponent(
        window.location.hash.replace(/^#activity-/, "").replace(/^#/, "")
      );
    }
    if (!targetActivity) return;

    const cards = activitiesList.querySelectorAll(".activity-card");
    for (const card of cards) {
      const cardName = card.dataset.activityName || "";
      if (
        cardName.toLowerCase() === targetActivity.toLowerCase() ||
        card.id.toLowerCase() === `activity-${targetActivity.toLowerCase()}`
      ) {
        setTimeout(() => {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("highlight-card");
          setTimeout(() => {
            card.classList.remove("highlight-card");
          }, 3500);
        }, 150);
        break;
      }
    }
  }

  // Function to render a single activity card
  function renderActivityCard(name, details) {
    const activityCard = document.createElement("div");
    activityCard.className = "activity-card";
    activityCard.dataset.activityName = name;
    activityCard.id = `activity-${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`;

    // Calculate spots and capacity
    const totalSpots = details.max_participants;
    const takenSpots = details.participants.length;
    const spotsLeft = totalSpots - takenSpots;
    const capacityPercentage = (takenSpots / totalSpots) * 100;
    const isFull = spotsLeft <= 0;

    // Determine capacity status class
    let capacityStatusClass = "capacity-available";
    if (isFull) {
      capacityStatusClass = "capacity-full";
    } else if (capacityPercentage >= 75) {
      capacityStatusClass = "capacity-near-full";
    }

    // Determine activity type
    const activityType = getActivityType(name, details.description);
    const typeInfo = activityTypes[activityType];

    // Format the schedule using the new helper function
    const formattedSchedule = formatSchedule(details);

    // Create activity tag
    const tagHtml = `
      <span class="activity-tag" style="background-color: ${typeInfo.color}; color: ${typeInfo.textColor}">
        ${typeInfo.label}
      </span>
    `;

    // Create capacity indicator
    const capacityIndicator = `
      <div class="capacity-container ${capacityStatusClass}">
        <div class="capacity-bar-bg">
          <div class="capacity-bar-fill" style="width: ${capacityPercentage}%"></div>
        </div>
        <div class="capacity-text">
          <span>${takenSpots} enrolled</span>
          <span>${spotsLeft} spots left</span>
        </div>
      </div>
    `;

    // Generate share information
    const shareUrl = getActivityShareUrl(name);
    const shareTitle = `Join ${name} at Mergington High School!`;
    const shareMessage = `Check out "${name}" at Mergington High School! ${details.description} Schedule: ${formattedSchedule}`;

    const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage + " " + shareUrl)}`;
    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    const emailShareUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareMessage + "\n\nFind out more and register here:\n" + shareUrl)}`;

    const supportsNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    const shareHtml = `
      <div class="activity-share">
        <span class="share-label">Share:</span>
        <div class="share-buttons">
          <button class="share-btn share-btn-copy tooltip" aria-label="Copy link to ${name}">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span class="tooltip-text">Copy link</span>
          </button>
          <a class="share-btn share-btn-whatsapp tooltip" href="${whatsappShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.43 0 .07 5.36.07 11.97c0 2.11.55 4.17 1.6 6L0 24l6.2-1.63a11.9 11.9 0 0 0 5.84 1.51h.01c6.61 0 11.97-5.36 11.97-11.97 0-3.2-1.25-6.21-3.48-8.49zm-8.47 18.42c-1.8 0-3.56-.48-5.1-1.4l-.36-.22-3.78 1 .99-3.68-.24-.38a9.94 9.94 0 0 1-1.53-5.25c0-5.5 4.48-9.98 9.99-9.98 2.67 0 5.18 1.04 7.07 2.93a9.92 9.92 0 0 1 2.93 7.05c0 5.5-4.48 9.98-9.97 9.98zm5.47-7.46c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/>
            </svg>
            <span class="tooltip-text">Share on WhatsApp</span>
          </a>
          <a class="share-btn share-btn-twitter tooltip" href="${twitterShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on X">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span class="tooltip-text">Share on X</span>
          </a>
          <a class="share-btn share-btn-facebook tooltip" href="${facebookShareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span class="tooltip-text">Share on Facebook</span>
          </a>
          <a class="share-btn share-btn-email tooltip" href="${emailShareUrl}" aria-label="Share via Email">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <span class="tooltip-text">Share via Email</span>
          </a>
          ${
            supportsNativeShare
              ? `
          <button class="share-btn share-btn-native tooltip" aria-label="More share options for ${name}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span class="tooltip-text">More options</span>
          </button>
          `
              : ""
          }
        </div>
      </div>
    `;

    activityCard.innerHTML = `
      ${tagHtml}
      <h4>${name}</h4>
      <p>${details.description}</p>
      <p class="tooltip">
        <strong>Schedule:</strong> ${formattedSchedule}
        <span class="tooltip-text">Regular meetings at this time throughout the semester</span>
      </p>
      ${capacityIndicator}
      <div class="participants-list">
        <h5>Current Participants:</h5>
        <ul>
          ${details.participants
            .map(
              (email) => `
            <li>
              ${email}
              ${
                currentUser
                  ? `
                <span class="delete-participant tooltip" data-activity="${name}" data-email="${email}">
                  ✖
                  <span class="tooltip-text">Unregister this student</span>
                </span>
              `
                  : ""
              }
            </li>
          `
            )
            .join("")}
        </ul>
      </div>
      ${shareHtml}
      <div class="activity-card-actions">
        ${
          currentUser
            ? `
          <button class="register-button" data-activity="${name}" ${
                isFull ? "disabled" : ""
              }>
            ${isFull ? "Activity Full" : "Register Student"}
          </button>
        `
            : `
          <div class="auth-notice">
            Teachers can register students.
          </div>
        `
        }
      </div>
    `;

    // Add click handlers for delete buttons
    const deleteButtons = activityCard.querySelectorAll(".delete-participant");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });

    // Add click handler for register button (only when authenticated)
    if (currentUser) {
      const registerButton = activityCard.querySelector(".register-button");
      if (!isFull) {
        registerButton.addEventListener("click", () => {
          openRegistrationModal(name);
        });
      }
    }

    // Add click handler for copy link button
    const copyButton = activityCard.querySelector(".share-btn-copy");
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const success = await copyTextToClipboard(shareUrl);
        const tooltip = copyButton.querySelector(".tooltip-text");
        const originalText = tooltip ? tooltip.textContent : "Copy link";
        if (success) {
          copyButton.classList.add("copied");
          if (tooltip) tooltip.textContent = "Link copied!";
          setTimeout(() => {
            copyButton.classList.remove("copied");
            if (tooltip) tooltip.textContent = originalText;
          }, 2000);
        }
      });
    }

    // Add click handler for native share button (if supported)
    const nativeShareButton = activityCard.querySelector(".share-btn-native");
    if (nativeShareButton && supportsNativeShare) {
      nativeShareButton.addEventListener("click", async () => {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareMessage,
            url: shareUrl,
          });
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Error sharing:", err);
          }
        }
      });
    }

    activitiesList.appendChild(activityCard);
  }

  // Event listeners for search and filter
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    displayFilteredActivities();
  });

  searchButton.addEventListener("click", (event) => {
    event.preventDefault();
    searchQuery = searchInput.value;
    displayFilteredActivities();
  });

  // Add event listeners to category filter buttons
  categoryFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      categoryFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current filter and display filtered activities
      currentFilter = button.dataset.category;
      displayFilteredActivities();
    });
  });

  // Add event listeners to day filter buttons
  dayFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      dayFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current day filter and fetch activities
      currentDay = button.dataset.day;
      fetchActivities();
    });
  });

  // Add event listeners for time filter buttons
  timeFilters.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active class
      timeFilters.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Update current time filter and fetch activities
      currentTimeRange = button.dataset.time;
      fetchActivities();
    });
  });

  // Open registration modal
  function openRegistrationModal(activityName) {
    modalActivityName.textContent = activityName;
    activityInput.value = activityName;
    registrationModal.classList.remove("hidden");
    // Add slight delay to trigger animation
    setTimeout(() => {
      registrationModal.classList.add("show");
    }, 10);
  }

  // Close registration modal
  function closeRegistrationModalHandler() {
    registrationModal.classList.remove("show");
    setTimeout(() => {
      registrationModal.classList.add("hidden");
      signupForm.reset();
    }, 300);
  }

  // Event listener for close button
  closeRegistrationModal.addEventListener(
    "click",
    closeRegistrationModalHandler
  );

  // Close modal when clicking outside of it
  window.addEventListener("click", (event) => {
    if (event.target === registrationModal) {
      closeRegistrationModalHandler();
    }
  });

  // Create and show confirmation dialog
  function showConfirmationDialog(message, confirmCallback) {
    // Create the confirmation dialog if it doesn't exist
    let confirmDialog = document.getElementById("confirm-dialog");
    if (!confirmDialog) {
      confirmDialog = document.createElement("div");
      confirmDialog.id = "confirm-dialog";
      confirmDialog.className = "modal hidden";
      confirmDialog.innerHTML = `
        <div class="modal-content">
          <h3>Confirm Action</h3>
          <p id="confirm-message"></p>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
            <button id="cancel-button" class="cancel-btn">Cancel</button>
            <button id="confirm-button" class="confirm-btn">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmDialog);

      // Style the buttons
      const cancelBtn = confirmDialog.querySelector("#cancel-button");
      const confirmBtn = confirmDialog.querySelector("#confirm-button");

      cancelBtn.style.backgroundColor = "#f1f1f1";
      cancelBtn.style.color = "#333";

      confirmBtn.style.backgroundColor = "#dc3545";
      confirmBtn.style.color = "white";
    }

    // Set the message
    const confirmMessage = document.getElementById("confirm-message");
    confirmMessage.textContent = message;

    // Show the dialog
    confirmDialog.classList.remove("hidden");
    setTimeout(() => {
      confirmDialog.classList.add("show");
    }, 10);

    // Handle button clicks
    const cancelButton = document.getElementById("cancel-button");
    const confirmButton = document.getElementById("confirm-button");

    // Remove any existing event listeners
    const newCancelButton = cancelButton.cloneNode(true);
    const newConfirmButton = confirmButton.cloneNode(true);
    cancelButton.parentNode.replaceChild(newCancelButton, cancelButton);
    confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

    // Add new event listeners
    newCancelButton.addEventListener("click", () => {
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    newConfirmButton.addEventListener("click", () => {
      confirmCallback();
      confirmDialog.classList.remove("show");
      setTimeout(() => {
        confirmDialog.classList.add("hidden");
      }, 300);
    });

    // Close when clicking outside
    confirmDialog.addEventListener("click", (event) => {
      if (event.target === confirmDialog) {
        confirmDialog.classList.remove("show");
        setTimeout(() => {
          confirmDialog.classList.add("hidden");
        }, 300);
      }
    });
  }

  // Handle unregistration with confirmation
  async function handleUnregister(event) {
    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to unregister students.",
        "error"
      );
      return;
    }

    const activity = event.target.dataset.activity;
    const email = event.target.dataset.email;

    // Show confirmation dialog
    showConfirmationDialog(
      `Are you sure you want to unregister ${email} from ${activity}?`,
      async () => {
        try {
          const response = await fetch(
            `/activities/${encodeURIComponent(
              activity
            )}/unregister?email=${encodeURIComponent(
              email
            )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
            {
              method: "POST",
            }
          );

          const result = await response.json();

          if (response.ok) {
            showMessage(result.message, "success");
            // Refresh the activities list
            fetchActivities();
          } else {
            showMessage(result.detail || "An error occurred", "error");
          }
        } catch (error) {
          showMessage("Failed to unregister. Please try again.", "error");
          console.error("Error unregistering:", error);
        }
      }
    );
  }

  // Show message function
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    // Hide message after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Check if user is authenticated
    if (!currentUser) {
      showMessage(
        "You must be logged in as a teacher to register students.",
        "error"
      );
      return;
    }

    const email = document.getElementById("email").value;
    const activity = activityInput.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(
          email
        )}&teacher_username=${encodeURIComponent(currentUser.username)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        closeRegistrationModalHandler();
        // Refresh the activities list after successful signup
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Expose filter functions to window for future UI control
  window.activityFilters = {
    setDayFilter,
    setTimeRangeFilter,
  };

  // Initialize app
  checkAuthentication();
  initializeFilters();
  fetchActivities();
});
