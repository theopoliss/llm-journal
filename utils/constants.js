export const JOURNAL_MODES = {
  SOLO: 'solo',
  CONVERSATIONAL: 'conversational',
};

export const RECORDING_STATES = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  WAITING_FOR_RESPONSE: 'waiting_for_response',
};

export const COLORS = {
  primary: '#000000',
  secondary: '#000000',
  success: '#000000',
  danger: '#000000',
  warning: '#000000',
  background: '#FFFFFF',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#000000',
};

export const SETTINGS_KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  DEFAULT_MODE: 'default_mode',
  AUTO_PLAY_RESPONSES: 'auto_play_responses',
  CLUSTER_COUNT: 'cluster_count',
  CLUSTER_THRESHOLD: 'cluster_threshold',
  LAST_CLUSTERING_DATE: 'last_clustering_date',
  SORT_PREFERENCE: 'sort_preference',
};

export const FOLDER_TYPES = {
  SMART: 'smart',
  MANUAL: 'manual',
};

export const SMART_FOLDER_TYPES = {
  RULE: 'rule',
  CLUSTER: 'cluster',
};

export const SORT_OPTIONS = {
  DATE_DESC: 'date_desc',
  DATE_ASC: 'date_asc',
};

export const LIBRARY_TABS = {
  ALL: 'all',
  SMART_FOLDERS: 'smart_folders',
  MANUAL_FOLDERS: 'manual_folders',
};
