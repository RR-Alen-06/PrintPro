import { DateFilterOption } from '../types';

export interface DateFilterButtonConfig {
  id: DateFilterOption;
  label: string;
}

export const DATE_FILTER_BUTTONS: DateFilterButtonConfig[] = [
  { id: 'current_session', label: 'Current Session' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'quarterly', label: 'Quarter' },
  { id: 'yearly', label: 'This Year' },
  { id: 'financial_year', label: 'Financial Year' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

export const REPORTS_DATE_FILTER_BUTTONS: DateFilterButtonConfig[] = [
  { id: 'current_session', label: 'Current Session' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'quarterly', label: 'Quarter' },
  { id: 'financial_year', label: 'Financial Year' },
  { id: 'custom', label: 'Custom' },
];

export const EXPENSES_DATE_FILTER_BUTTONS: DateFilterButtonConfig[] = [
  { id: 'current_session', label: 'Current Session' },
  { id: 'all_time', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'yearly', label: 'This Year' },
  { id: 'financial_year', label: 'Financial Year' },
  { id: 'custom', label: 'Custom' },
];

export const ACCOUNTING_DATE_FILTER_BUTTONS: DateFilterButtonConfig[] = [
  { id: 'current_session', label: 'Current Session' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
];

