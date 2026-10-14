function renderWeeklyCalendar(container, activities, filters) {
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
  const entriesByDay = days.map(() => []);
  const unscheduled = [];

  function minutes(time) {
    if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [hour, minute] = time.split(":").map(Number);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  }

  function dayIsVisible(day) {
    return (!filters.day || filters.day === day) &&
      (!filters.weekendOnly || ["Saturday", "Sunday"].includes(day));
  }

  Object.entries(activities).forEach(([name, details]) => {
    const schedule = details.schedule_details;
    const start = minutes(schedule?.start_time);
    const end = minutes(schedule?.end_time);
    const scheduledDays = schedule?.days?.filter((day) => days.includes(day)) || [];
    if (start === null || scheduledDays.length === 0) {
      unscheduled.push({ name, details });
      return;
    }

    scheduledDays.forEach((day) => {
      const dayIndex = days.indexOf(day);
      // An unspecified end gets a one-hour placeholder, not an invented end time.
      const finish = end === null ? Math.min(start + 60, 1440) : end;
      if (finish > start) {
        if (dayIsVisible(day)) {
          entriesByDay[dayIndex].push({ name, details, start, end: finish });
        }
      } else if (finish < start) {
        if (dayIsVisible(day)) {
          entriesByDay[dayIndex].push({ name, details, start, end: 1440 });
        }
        const nextDay = (dayIndex + 1) % 7;
        if (finish > 0 && dayIsVisible(days[nextDay])) {
          entriesByDay[nextDay].push({ name, details, start: 0, end: finish });
        }
      } else {
        unscheduled.push({ name, details });
      }
    });
  });

  const entries = entriesByDay.flat();
  const firstHour = Math.floor(Math.min(360, ...entries.map((entry) => entry.start)) / 60);
  const lastHour = Math.ceil(Math.max(1080, ...entries.map((entry) => entry.end)) / 60);
  const pixelsPerHour = 64;

  const heading = document.createElement("h3");
  heading.textContent = "Weekly activity calendar";
  container.appendChild(heading);
  const detailsPanel = document.createElement("p");
  detailsPanel.className = "calendar-details";
  detailsPanel.setAttribute("aria-live", "polite");
  detailsPanel.textContent = "Hover, focus, or tap an activity for full details. Dashed entries have no specified end time.";
  container.appendChild(detailsPanel);

  function createEntry(entry) {
    const { name, details } = entry;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-entry";
    if (!details.schedule_details?.end_time) button.classList.add("calendar-open-ended");
    const fullDetails = [
      name,
      details.description,
      `Schedule: ${filters.formatSchedule(details)}`,
      ...(details.schedule_details && !details.schedule_details.end_time
        ? ["End time not specified; shown as a one-hour placeholder."]
        : []),
      `${details.participants.length} / ${details.max_participants} enrolled`,
      `Current participants: ${details.participants.join(", ") || "None"}`,
    ].join("\n");
    button.title = fullDetails;
    button.setAttribute("aria-label", fullDetails);
    const label = document.createElement("strong");
    label.textContent = name;
    const enrollment = document.createElement("span");
    enrollment.textContent = `${details.participants.length} / ${details.max_participants} enrolled`;
    button.append(label, enrollment);
    const showDetails = () => { detailsPanel.textContent = fullDetails; };
    button.addEventListener("mouseenter", showDetails);
    button.addEventListener("focus", showDetails);
    button.addEventListener("click", showDetails);
    return button;
  }

  const scroller = document.createElement("div");
  scroller.className = "calendar-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "Weekly calendar, Sunday through Saturday");
  const grid = document.createElement("div");
  grid.className = "calendar-grid";
  const timeHeading = document.createElement("div");
  timeHeading.className = "calendar-day-heading";
  timeHeading.textContent = "Time";
  grid.appendChild(timeHeading);
  days.forEach((day) => {
    const dayHeading = document.createElement("div");
    dayHeading.className = "calendar-day-heading";
    dayHeading.textContent = day;
    grid.appendChild(dayHeading);
  });
  const timeAxis = document.createElement("div");
  timeAxis.className = "calendar-time-axis";
  timeAxis.style.height = `${(lastHour - firstHour) * pixelsPerHour}px`;
  for (let hour = firstHour; hour <= lastHour; hour++) {
    const label = document.createElement("span");
    label.textContent = `${hour % 12 || 12} ${hour % 24 >= 12 ? "PM" : "AM"}`;
    label.style.top = `${(hour - firstHour) * pixelsPerHour}px`;
    timeAxis.appendChild(label);
  }
  grid.appendChild(timeAxis);

  entriesByDay.forEach((dayEntries, dayIndex) => {
    const column = document.createElement("div");
    column.className = "calendar-day";
    column.setAttribute("aria-label", days[dayIndex]);
    column.style.height = timeAxis.style.height;
    dayEntries.sort((a, b) => a.start - b.start || a.end - b.end);

    // Each connected overlap group shares lanes; meetings that touch do not overlap.
    let group = [];
    let groupEnd = -1;
    function renderGroup() {
      const laneEnds = [];
      group.forEach((entry) => {
        let lane = laneEnds.findIndex((end) => end <= entry.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = entry.end;
        entry.lane = lane;
      });
      group.forEach((entry) => {
        const button = createEntry(entry);
        button.style.top = `${(entry.start - firstHour * 60) / 60 * pixelsPerHour}px`;
        button.style.height = `${(entry.end - entry.start) / 60 * pixelsPerHour}px`;
        button.style.left = `${entry.lane / laneEnds.length * 100}%`;
        button.style.width = `${100 / laneEnds.length}%`;
        column.appendChild(button);
      });
    }
    dayEntries.forEach((entry) => {
      if (entry.start >= groupEnd) {
        renderGroup();
        group = [];
      }
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.end);
    });
    renderGroup();
    grid.appendChild(column);
  });
  scroller.appendChild(grid);
  container.appendChild(scroller);

  if (unscheduled.length) {
    const notice = document.createElement("p");
    notice.textContent = "Activities without a usable meeting time:";
    container.appendChild(notice);
    unscheduled.forEach((entry) => {
      const button = createEntry(entry);
      button.classList.add("calendar-unscheduled");
      container.appendChild(button);
    });
  }
}
