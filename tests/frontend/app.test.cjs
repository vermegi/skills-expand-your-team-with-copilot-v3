const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { test, mock } = require("node:test");
const { JSDOM } = require("jsdom");

const root = resolve(process.env.TARGET_SOURCE_ROOT || ".");
const html = readFileSync(join(root, "src", "static", "index.html"), "utf8");
const script = readFileSync(join(root, "src", "static", "app.js"), "utf8");
const teacher = {
  username: "test-teacher",
  display_name: "Test Teacher",
  role: "teacher",
};
const activities = {
  "Coding Club": {
    description: "Learn programming",
    schedule_details: { days: ["Monday"], start_time: "15:00", end_time: "17:00" },
    max_participants: 4,
    participants: ["existing@example.edu"],
  },
  "Soccer Club": {
    description: "Athletic practice",
    schedule_details: { days: ["Saturday"], start_time: "10:00", end_time: "12:00" },
    max_participants: 1,
    participants: ["player@example.edu"],
  },
};

async function settle() {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
}

async function setup(t, { data = activities, storage = {}, respond } = {}) {
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  t.after(() => window.close());
  // Let jsdom's automatic event finish before installing the actual app listener.
  await new Promise((done) => window.document.addEventListener("DOMContentLoaded", done));
  for (const [key, value] of Object.entries(storage)) {
    window.localStorage.setItem(key, value);
  }
  const errors = [];
  window.console.error = (...args) => errors.push(args);
  window.fetch = mock.fn(async (url, options) => {
    const answer = respond ? await respond(url, options) : undefined;
    if (answer !== undefined) return answer;
    const value = url.startsWith("/auth/check-session") ? teacher : data;
    return { ok: true, json: async () => value };
  });
  window.eval(script);
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  await settle();
  return {
    window,
    document: window.document,
    fetch: window.fetch,
    errors,
  };
}

function names(document) {
  return Array.from(document.querySelectorAll(".activity-card h4"), (node) => node.textContent);
}

function requests(fetch, path) {
  return fetch.mock.calls.filter((call) => call.arguments[0].startsWith(path));
}

function submit(window, selector) {
  window.document.querySelector(selector).dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

for (const [saved, expected] of [[undefined, "light"], ["dark", "dark"], ["invalid", "light"]]) {
  test(`theme initializes from ${saved}`, async (t) => {
    const storage = saved === undefined ? {} : { theme: saved };
    const { document } = await setup(t, { storage });
    assert.equal(document.documentElement.dataset.theme, expected);
    assert.equal(document.querySelector("#theme-toggle").getAttribute("aria-pressed"),
      String(expected === "dark"));
  });
}

test("theme toggle persists the preference and accessible state", async (t) => {
  const { window, document } = await setup(t);
  const button = document.querySelector("#theme-toggle");
  button.click();
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(window.localStorage.getItem("theme"), "dark");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.getAttribute("aria-label"), "Switch to light mode");
  button.click();
  assert.equal(window.localStorage.getItem("theme"), "light");
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("cards render schedules, participants, capacity and anonymous controls", async (t) => {
  const { document, errors } = await setup(t);
  assert.deepEqual(names(document), ["Coding Club", "Soccer Club"]);
  const card = document.querySelector(".activity-card");
  assert.match(card.textContent, /Monday, 3:00 PM - 5:00 PM/);
  assert.match(card.textContent, /existing@example.edu/);
  assert.match(card.textContent, /1 enrolled/);
  assert.match(card.textContent, /3 spots left/);
  assert.equal(card.querySelector(".capacity-bar-fill").style.width, "25%");
  assert.equal(document.querySelectorAll(".register-button").length, 0);
  assert.equal(document.querySelectorAll(".delete-participant").length, 0);
  assert.ok(document.body.classList.contains("not-authenticated"));
  assert.deepEqual(errors, []);
});

for (const [label, details, expected] of [
  ["midnight", { days: ["Sunday"], start_time: "00:05", end_time: "12:00" },
    "Sunday, 12:05 AM - 12:00 PM"],
  ["missing end time", { days: ["Tuesday"], start_time: "17:00" },
    "Tuesday, 5:00 PM"],
  ["legacy schedule", undefined, "Legacy schedule"],
]) {
  test(`schedule formatting supports ${label}`, async (t) => {
    const data = {
      "Coding Club": {
        ...activities["Coding Club"],
        schedule: "Legacy schedule",
        schedule_details: details,
      },
    };
    const { document } = await setup(t, { data });
    assert.ok(document.querySelector(".activity-card .tooltip").textContent.includes(expected));
  });
}

test("search is case-insensitive and includes name, description and schedule", async (t) => {
  const { window, document } = await setup(t);
  const input = document.querySelector("#activity-search");
  for (const query of ["CODING", "PROGRAMMING", "MONDAY"]) {
    input.value = query;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.deepEqual(names(document), ["Coding Club"]);
  }
  input.value = "no matching club";
  document.querySelector("#search-button").click();
  assert.deepEqual(names(document), []);
  assert.match(document.querySelector(".no-results").textContent, /No activities found/);
  input.value = "";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(names(document).length, 2);
});

test("category filters change the active button and rendered cards", async (t) => {
  const { document } = await setup(t);
  const sports = document.querySelector('[data-category="sports"]');
  sports.click();
  assert.deepEqual(names(document), ["Soccer Club"]);
  assert.ok(sports.classList.contains("active"));
  assert.equal(document.querySelectorAll(".category-filter.active").length, 1);
  document.querySelector('[data-category="all"]').click();
  assert.equal(names(document).length, 2);
});

test("day and time controls send encoded API filters", async (t) => {
  const { document, fetch } = await setup(t);
  document.querySelector('[data-day="Monday"]').click();
  await settle();
  document.querySelector('[data-time="morning"]').click();
  await settle();
  assert.equal(fetch.mock.calls.at(-1).arguments[0],
    "/activities?day=Monday&start_time=06%3A00&end_time=08%3A00");
  document.querySelector('[data-time="afternoon"]').click();
  await settle();
  assert.equal(fetch.mock.calls.at(-1).arguments[0],
    "/activities?day=Monday&start_time=15%3A00&end_time=18%3A00");
});

test("exposed filter helpers update active state and weekend filtering", async (t) => {
  const { window, document, fetch } = await setup(t);
  window.activityFilters.setDayFilter("Saturday");
  await settle();
  assert.ok(document.querySelector('[data-day="Saturday"]').classList.contains("active"));
  window.activityFilters.setTimeRangeFilter("weekend");
  await settle();
  assert.equal(fetch.mock.calls.at(-1).arguments[0], "/activities?day=Saturday");
  assert.deepEqual(names(document), ["Soccer Club"]);
  assert.ok(document.querySelector('[data-time="weekend"]').classList.contains("active"));
  window.activityFilters.setDayFilter("");
  window.activityFilters.setTimeRangeFilter("");
  await settle();
  assert.equal(fetch.mock.calls.at(-1).arguments[0], "/activities");
  assert.equal(names(document).length, 2);
});

test("empty activity data renders the no-results message", async (t) => {
  const { document } = await setup(t, { data: {} });
  assert.match(document.querySelector(".no-results").textContent, /No activities found/);
});

test("network failure displays a load error rather than activity cards", async (t) => {
  const { document, errors } = await setup(t, {
    respond: async () => { throw new Error("Offline"); },
  });
  assert.match(document.querySelector("#activities-list").textContent, /Failed to load activities/);
  assert.equal(names(document).length, 0);
  assert.equal(errors.length, 1);
});

test("valid saved session enables registration but disables full activities", async (t) => {
  const { document, fetch } = await setup(t, {
    storage: { currentUser: JSON.stringify(teacher) },
  });
  assert.equal(requests(fetch, "/auth/check-session")[0].arguments[0],
    "/auth/check-session?username=test-teacher");
  assert.equal(document.querySelector("#display-name").textContent, teacher.display_name);
  assert.ok(document.querySelector("#login-button").classList.contains("hidden"));
  assert.ok(!document.body.classList.contains("not-authenticated"));
  const buttons = document.querySelectorAll(".register-button");
  assert.equal(buttons[0].disabled, false);
  assert.equal(buttons[1].disabled, true);
  assert.equal(buttons[1].textContent.trim(), "Activity Full");
  buttons[0].click();
  assert.equal(document.querySelector("#activity").value, "Coding Club");
  assert.equal(document.querySelector("#modal-activity-name").textContent, "Coding Club");
  assert.ok(!document.querySelector("#registration-modal").classList.contains("hidden"));
});

test("near-full capacity uses the warning class", async (t) => {
  const data = {
    "Coding Club": {
      ...activities["Coding Club"],
      participants: ["one@example.edu", "two@example.edu", "three@example.edu"],
    },
  };
  const { document } = await setup(t, { data });
  assert.ok(document.querySelector(".capacity-near-full"));
  assert.equal(document.querySelector(".capacity-bar-fill").style.width, "75%");
});

test("invalid saved session clears storage and authenticated controls", async (t) => {
  const { window, document } = await setup(t, {
    storage: { currentUser: JSON.stringify(teacher) },
    respond: async (url) => url.startsWith("/auth/check-session")
      ? { ok: false, json: async () => ({ detail: "Teacher not found" }) }
      : undefined,
  });
  assert.equal(window.localStorage.getItem("currentUser"), null);
  assert.ok(document.body.classList.contains("not-authenticated"));
  assert.equal(document.querySelectorAll(".register-button").length, 0);
});

test("malformed saved user is cleared and reported", async (t) => {
  const { window, document, errors } = await setup(t, {
    storage: { currentUser: "{not json" },
  });
  assert.equal(window.localStorage.getItem("currentUser"), null);
  assert.ok(document.body.classList.contains("not-authenticated"));
  assert.equal(errors.length, 1);
});

test("login submits encoded credentials, saves public user and updates UI", async (t) => {
  const { window, document, fetch } = await setup(t, {
    respond: async (url) => url.startsWith("/auth/login")
      ? { ok: true, json: async () => teacher }
      : undefined,
  });
  document.querySelector("#login-button").click();
  assert.ok(document.querySelector("#login-modal").classList.contains("show"));
  document.querySelector("#username").value = "teacher+name";
  document.querySelector("#password").value = "test & password";
  submit(window, "#login-form");
  await settle();
  const [url, options] = requests(fetch, "/auth/login")[0].arguments;
  const params = new URL(url, "http://localhost").searchParams;
  assert.equal(params.get("username"), "teacher+name");
  assert.equal(params.get("password"), "test & password");
  assert.equal(options.method, "POST");
  assert.deepEqual(JSON.parse(window.localStorage.getItem("currentUser")), teacher);
  assert.equal(document.querySelector("#display-name").textContent, teacher.display_name);
  assert.match(document.querySelector("#message").textContent, /Welcome, Test Teacher!/);
  assert.ok(!document.querySelector("#login-modal").classList.contains("show"));
});

test("invalid login displays API error without authenticating", async (t) => {
  const { window, document } = await setup(t, {
    respond: async (url) => url.startsWith("/auth/login")
      ? { ok: false, json: async () => ({ detail: "Invalid username or password" }) }
      : undefined,
  });
  submit(window, "#login-form");
  await settle();
  assert.equal(document.querySelector("#login-message").textContent, "Invalid username or password");
  assert.equal(window.localStorage.getItem("currentUser"), null);
  assert.ok(document.body.classList.contains("not-authenticated"));
});

test("login network failure displays error and logs the failure", async (t) => {
  const { window, document, errors } = await setup(t, {
    respond: async (url) => {
      if (url.startsWith("/auth/login")) throw new Error("Offline");
    },
  });
  submit(window, "#login-form");
  await settle();
  assert.match(document.querySelector("#login-message").textContent, /Login failed/);
  assert.equal(errors.length, 1);
});

test("logout removes storage and teacher-only actions", async (t) => {
  const { window, document } = await setup(t, {
    storage: { currentUser: JSON.stringify(teacher) },
  });
  document.querySelector("#logout-button").click();
  await settle();
  assert.equal(window.localStorage.getItem("currentUser"), null);
  assert.equal(document.querySelector("#display-name").textContent, "");
  assert.equal(document.querySelectorAll(".register-button").length, 0);
  assert.ok(document.body.classList.contains("not-authenticated"));
});

test("anonymous signup is rejected without making a mutation request", async (t) => {
  const { window, document, fetch } = await setup(t);
  submit(window, "#signup-form");
  await settle();
  assert.match(document.querySelector("#message").textContent, /must be logged in/);
  assert.equal(requests(fetch, "/activities/").length, 0);
});

for (const ok of [true, false]) {
  test(`signup ${ok ? "success" : "failure"} sends correct request and message`, async (t) => {
    const { window, document, fetch } = await setup(t, {
      storage: { currentUser: JSON.stringify(teacher) },
      respond: async (url) => url.includes("/signup?")
        ? { ok, json: async () => ok ? { message: "Student registered" } : { detail: "Already signed up" } }
        : undefined,
    });
    document.querySelector(".register-button").click();
    document.querySelector("#email").value = "student+test@example.edu";
    submit(window, "#signup-form");
    await settle();
    const [url, options] = requests(fetch, "/activities/")[0].arguments;
    assert.equal(url,
      "/activities/Coding%20Club/signup?email=student%2Btest%40example.edu&teacher_username=test-teacher");
    assert.equal(options.method, "POST");
    assert.equal(document.querySelector("#message").textContent,
      ok ? "Student registered" : "Already signed up");
    assert.ok(document.querySelector("#message").classList.contains(ok ? "success" : "error"));
  });
}

test("unregister cancellation makes no request; confirmation sends correct request", async (t) => {
  const { document, fetch } = await setup(t, {
    storage: { currentUser: JSON.stringify(teacher) },
    respond: async (url) => url.includes("/unregister?")
      ? { ok: true, json: async () => ({ message: "Student unregistered" }) }
      : undefined,
  });
  document.querySelector(".delete-participant").click();
  assert.match(document.querySelector("#confirm-message").textContent, /existing@example.edu/);
  document.querySelector("#cancel-button").click();
  await settle();
  assert.equal(requests(fetch, "/activities/").length, 0);
  document.querySelector(".delete-participant").click();
  document.querySelector("#confirm-button").click();
  await settle();
  const [url, options] = requests(fetch, "/activities/")[0].arguments;
  assert.equal(url,
    "/activities/Coding%20Club/unregister?email=existing%40example.edu&teacher_username=test-teacher");
  assert.equal(options.method, "POST");
  assert.equal(requests(fetch, "/activities/").length, 1);
  assert.equal(document.querySelector("#message").textContent, "Student unregistered");
});
