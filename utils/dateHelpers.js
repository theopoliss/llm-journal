/**
 * Date utility functions for grouping journal entries by time periods
 */

// Time period identifiers
const PERIOD_TYPES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  PREV_7_DAYS: 'prev_7_days',
  PREV_30_DAYS: 'prev_30_days',
  MONTH: 'month', // prefix: month_YYYY_MM
  YEAR: 'year',   // prefix: year_YYYY
};

/**
 * Get the start of day for a given date (00:00:00)
 * @param {Date} date - Date object
 * @returns {Date} - Date at 00:00:00
 */
const getStartOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Get the start of a specific day offset from today
 * @param {number} daysAgo - Number of days in the past (0 = today)
 * @returns {Date} - Date at 00:00:00
 */
const getStartOfDayOffset = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getStartOfDay(date);
};

/**
 * Determine which time period an entry belongs to
 * @param {string} entryDateString - ISO date string from entry.created_at
 * @param {Date} now - Current date/time
 * @returns {string} - Period identifier (e.g., 'today', 'month_2024_12', 'year_2023')
 */
export const getTimePeriodForEntry = (entryDateString, now = new Date()) => {
  const entryDate = new Date(entryDateString);
  const currentYear = now.getFullYear();
  const entryYear = entryDate.getFullYear();

  // Calculate time boundaries
  const todayStart = getStartOfDay(now);
  const yesterdayStart = getStartOfDayOffset(1);
  const prev7DaysStart = getStartOfDayOffset(7);
  const prev30DaysStart = getStartOfDayOffset(30);

  // Check each period in order
  if (entryDate >= todayStart) {
    return PERIOD_TYPES.TODAY;
  }

  if (entryDate >= yesterdayStart) {
    return PERIOD_TYPES.YESTERDAY;
  }

  if (entryDate >= prev7DaysStart) {
    return PERIOD_TYPES.PREV_7_DAYS;
  }

  if (entryDate >= prev30DaysStart) {
    return PERIOD_TYPES.PREV_30_DAYS;
  }

  // For entries older than 30 days
  if (entryYear < currentYear) {
    // Previous years: group by year only
    return `${PERIOD_TYPES.YEAR}_${entryYear}`;
  } else {
    // Current year but older than 30 days: group by month
    const month = String(entryDate.getMonth() + 1).padStart(2, '0');
    return `${PERIOD_TYPES.MONTH}_${entryYear}_${month}`;
  }
};

/**
 * Get human-readable section title for a period key
 * @param {string} periodKey - Period identifier from getTimePeriodForEntry
 * @returns {string} - Human-readable title
 */
export const getSectionTitle = (periodKey) => {
  if (periodKey === PERIOD_TYPES.TODAY) {
    return 'Today';
  }

  if (periodKey === PERIOD_TYPES.YESTERDAY) {
    return 'Yesterday';
  }

  if (periodKey === PERIOD_TYPES.PREV_7_DAYS) {
    return 'Previous 7 Days';
  }

  if (periodKey === PERIOD_TYPES.PREV_30_DAYS) {
    return 'Previous 30 Days';
  }

  // Handle month format: month_YYYY_MM
  if (periodKey.startsWith(PERIOD_TYPES.MONTH)) {
    const parts = periodKey.split('_');
    const year = parts[1];
    const month = parts[2];
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Handle year format: year_YYYY
  if (periodKey.startsWith(PERIOD_TYPES.YEAR)) {
    const year = periodKey.split('_')[1];
    return year;
  }

  return periodKey;
};

/**
 * Get sort priority for a period key (lower = newer)
 * @param {string} periodKey - Period identifier
 * @returns {number} - Sort priority
 */
const getPeriodPriority = (periodKey) => {
  if (periodKey === PERIOD_TYPES.TODAY) return 0;
  if (periodKey === PERIOD_TYPES.YESTERDAY) return 1;
  if (periodKey === PERIOD_TYPES.PREV_7_DAYS) return 2;
  if (periodKey === PERIOD_TYPES.PREV_30_DAYS) return 3;

  // Month: extract year and month for sorting
  if (periodKey.startsWith(PERIOD_TYPES.MONTH)) {
    const parts = periodKey.split('_');
    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]);
    // Create a sortable number: YYYYMM
    return 1000 + (10000 - year) * 100 + (12 - month);
  }

  // Year: extract year for sorting
  if (periodKey.startsWith(PERIOD_TYPES.YEAR)) {
    const year = parseInt(periodKey.split('_')[1]);
    // Higher year = lower priority number (newer first)
    return 100000 + (10000 - year);
  }

  return 999999; // Unknown periods go to the end
};

/**
 * Group journal entries by time periods
 * @param {Array} entries - Array of journal entry objects
 * @param {string} sortBy - Sort preference ('date_desc' or 'date_asc')
 * @returns {Array} - Array of section objects for SectionList
 */
export const groupEntriesByTimePeriod = (entries, sortBy = 'date_desc') => {
  if (!entries || entries.length === 0) {
    return [];
  }

  const now = new Date();
  const groupMap = new Map();

  // Group entries into periods
  entries.forEach((entry) => {
    const periodKey = getTimePeriodForEntry(entry.created_at, now);

    if (!groupMap.has(periodKey)) {
      groupMap.set(periodKey, []);
    }

    groupMap.get(periodKey).push(entry);
  });

  // Convert map to sections array
  const sections = Array.from(groupMap.entries()).map(([periodKey, data]) => ({
    title: getSectionTitle(periodKey),
    data: data,
    periodKey: periodKey,
    priority: getPeriodPriority(periodKey),
  }));

  // Sort sections based on sort preference
  if (sortBy === 'date_asc') {
    // Oldest first: reverse section order and reverse entries within each section
    sections.sort((a, b) => b.priority - a.priority);
    sections.forEach(section => {
      section.data.reverse();
    });
  } else {
    // Newest first (default): normal section order, entries already sorted
    sections.sort((a, b) => a.priority - b.priority);
  }

  return sections;
};

/**
 * Check if a specific time period should be shown
 * @param {string} periodKey - Period identifier
 * @param {boolean} hasEntries - Whether this period has entries
 * @returns {boolean} - True if section should be shown
 */
export const shouldShowSection = (periodKey, hasEntries) => {
  // Only show sections that have entries
  return hasEntries;
};

/**
 * Get the date range for a given period key (useful for debugging/testing)
 * @param {string} periodKey - Period identifier
 * @returns {Object} - Object with start and end dates
 */
export const getPeriodDateRange = (periodKey) => {
  const now = new Date();

  if (periodKey === PERIOD_TYPES.TODAY) {
    return {
      start: getStartOfDay(now),
      end: now,
    };
  }

  if (periodKey === PERIOD_TYPES.YESTERDAY) {
    const yesterdayStart = getStartOfDayOffset(1);
    const yesterdayEnd = new Date(getStartOfDay(now).getTime() - 1);
    return {
      start: yesterdayStart,
      end: yesterdayEnd,
    };
  }

  if (periodKey === PERIOD_TYPES.PREV_7_DAYS) {
    const start = getStartOfDayOffset(7);
    const end = new Date(getStartOfDayOffset(1).getTime() - 1);
    return {
      start: start,
      end: end,
    };
  }

  if (periodKey === PERIOD_TYPES.PREV_30_DAYS) {
    const start = getStartOfDayOffset(30);
    const end = new Date(getStartOfDayOffset(7).getTime() - 1);
    return {
      start: start,
      end: end,
    };
  }

  // For months and years, return approximate ranges
  if (periodKey.startsWith(PERIOD_TYPES.MONTH)) {
    const parts = periodKey.split('_');
    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]) - 1;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (periodKey.startsWith(PERIOD_TYPES.YEAR)) {
    const year = parseInt(periodKey.split('_')[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  return { start: null, end: null };
};
