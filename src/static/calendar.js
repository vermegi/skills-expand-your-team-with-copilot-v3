function renderActivityCalendar(container, activities, formatSchedule, filters) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const eventsByDay = days.map(() => []);
  const unscheduled = [];
  const pixelsPerMinute = 1.5;

  function minutes(time) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  }

  function detailsText(name, details) {
    return [
      name,
      details.description,
      `Schedule: ${formatSchedule(details)}`,
      `Enrollment: ${details.participants.length} / ${details.max_participants}`,
      `Spots left: ${Math.max(0, details.max_participants - details.participants.length)}`,
      `Participants: ${details.participants.join(", ") || "None"}`,
    ].join("\n");
  }

  function addEvent(day, event) {
    if (filters.day && days[day] !== filters.day) return;
    if (filters.weekend && day !== 0 && day !== 6) return;
    eventsByDay[day].push(event);
  }

  Object.entries(activities).forEach(([name, details]) => {
    const schedule = details.schedule_details;
    const start = schedule ? minutes(schedule.start_time) : null;
    const end = schedule ? minutes(schedule.end_time) : null;
    const meetingDays = schedule?.days?.filter((day) => days.includes(day)) || [];
    if (start === null || end === null || start === end || !meetingDays.length) {
      unscheduled.push([name, details]);
      return;
    }
    new Set(meetingDays).forEach((day) => {
      const index = days.indexOf(day);
      if (end > start) {
        addEvent(index, { name, details, start, end });
      } else {
        // Split overnight meetings at midnight into the following day.
        addEvent(index, { name, details, start, end: 1440 });
        if (end > 0) addEvent((index + 1) % 7, { name, details, start: 0, end });
      }
    });
  });

  const events = eventsByDay.flat();
  const startHour = events.length ? Math.floor(Math.min(...events.map((event) => event.start)) / 60) : 8;
  const endHour = events.length ? Math.ceil(Math.max(...events.map((event) => event.end)) / 60) : 18;
  const height = (endHour - startHour) * 60 * pixelsPerMinute;
  const calendar = document.createElement("div");
  calendar.className = "weekly-calendar";
  calendar.setAttribute("aria-label", "Weekly activity calendar, Sunday through Saturday");

  const corner = document.createElement("div");
  corner.className = "calendar-heading";
  corner.textContent = "Time";
  calendar.appendChild(corner);
  days.forEach((day) => {
    const heading = document.createElement("div");
    heading.className = "calendar-heading";
    heading.textContent = day;
    calendar.appendChild(heading);
  });

  const timeAxis = document.createElement("div");
  timeAxis.className = "calendar-time-axis";
  timeAxis.style.height = `${height}px`;
  for (let hour = startHour; hour <= endHour; hour++) {
    const label = document.createElement("span");
    label.className = "calendar-time-label";
    label.style.top = `${(hour - startHour) * 60 * pixelsPerMinute}px`;
    label.textContent = `${hour % 12 || 12} ${hour % 24 >= 12 ? "PM" : "AM"}`;
    timeAxis.appendChild(label);
  }
  calendar.appendChild(timeAxis);

  eventsByDay.forEach((dayEvents, dayIndex) => {
    const column = document.createElement("div");
    column.className = "calendar-day";
    column.setAttribute("aria-label", days[dayIndex]);
    column.style.height = `${height}px`;
    dayEvents.sort((a, b) => a.start - b.start || a.end - b.end);

    let group = [];
    let groupEnd = -1;
    let laneEnds = [];
    function finishGroup() {
      group.forEach((event) => {
        event.lanes = laneEnds.length;
      });
      group = [];
      laneEnds = [];
    }

    dayEvents.forEach((event) => {
      if (event.start >= groupEnd) finishGroup();
      let lane = laneEnds.findIndex((end) => end <= event.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.end;
      event.lane = lane;
      group.push(event);
      groupEnd = Math.max(...group.map((item) => item.end));
    });
    finishGroup();

    dayEvents.forEach((event) => {
      const entry = document.createElement("div");
      entry.className = "calendar-event";
      entry.tabIndex = 0;
      entry.style.top = `${(event.start - startHour * 60) * pixelsPerMinute}px`;
      entry.style.height = `${(event.end - event.start) * pixelsPerMinute}px`;
      entry.style.left = `${event.lane * 100 / event.lanes}%`;
      entry.style.width = `${100 / event.lanes}%`;
      entry.title = detailsText(event.name, event.details);
      entry.setAttribute("aria-label", entry.title);

      const name = document.createElement("strong");
      name.textContent = event.name;
      const enrollment = document.createElement("span");
      enrollment.textContent = `${event.details.participants.length}/${event.details.max_participants} enrolled`;
      entry.append(name, enrollment);
      column.appendChild(entry);
    });
    calendar.appendChild(column);
  });
  container.appendChild(calendar);

  if (unscheduled.length) {
    const note = document.createElement("div");
    note.className = "no-results";
    note.textContent = "Activities without a complete meeting time (see Cards):";
    unscheduled.forEach(([name, details]) => {
      const item = document.createElement("p");
      item.textContent = name;
      item.title = detailsText(name, details);
      note.appendChild(item);
    });
    container.appendChild(note);
  }
}
