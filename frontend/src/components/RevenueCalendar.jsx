import { useRef, useState } from 'react';
import { formatCurrency } from '../utils/helpers';

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIST(date) {
  // Return a YYYY-MM-DD string in IST for the given Date object
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getCalendarDays(year, month) {
  // Returns an array of Date objects for every day that appears in the
  // calendar grid for the given month (including padding from adjacent months)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const days = [];

  // Pad start of grid with days from the previous month
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }
  // Days of the current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

/**
 * RevenueCalendar
 *
 * Props:
 *   fetchRevenue: async (dateStr: string "YYYY-MM-DD") => { totalRevenue: number, totalOrders: number }
 *   title:        string   (optional — card heading)
 */
export default function RevenueCalendar({ fetchRevenue, title = '📅 Daily Revenue' }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate]   = useState(null); // "YYYY-MM-DD"
  const [revenueData, setRevenueData]     = useState(null); // { totalRevenue, totalOrders }
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const abortRef = useRef(null);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days  = getCalendarDays(year, month);
  const todayIST = toIST(today);

  const monthLabel = currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const handleDayClick = async (day) => {
    if (!day) return;
    const dateStr = toIST(day);
    setSelectedDate(dateStr);
    setRevenueData(null);
    setError(null);

    // Cancel any pending previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const data = await fetchRevenue(dateStr);
      if (!controller.signal.aborted) {
        setRevenueData(data);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError('Failed to fetch revenue data.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="text-sm px-3 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors font-medium"
        >
          ‹ Prev
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="text-sm px-3 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors font-medium"
        >
          Next ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-gray-400 py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;

          const dateStr  = toIST(day);
          const isToday    = dateStr === todayIST;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => handleDayClick(day)}
              className={[
                'flex items-center justify-center rounded-xl text-sm font-medium h-9 w-full transition-all',
                isSelected
                  ? 'bg-orange-500 text-white shadow-md'
                  : isToday
                  ? 'ring-2 ring-orange-400 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600',
              ].join(' ')}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Revenue result card */}
      <div className="mt-4 min-h-[80px]">
        {!selectedDate && (
          <p className="text-sm text-gray-400 text-center py-4">Select a date to view revenue</p>
        )}

        {selectedDate && loading && (
          <div className="flex justify-center py-6">
            <div className="spinner" />
          </div>
        )}

        {selectedDate && error && !loading && (
          <p className="text-sm text-red-500 text-center py-4">{error}</p>
        )}

        {selectedDate && revenueData && !loading && (
          <div className="rounded-2xl bg-orange-50 dark:bg-orange-900/20 p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
            <p className="text-3xl font-display font-bold text-orange-500 leading-tight">
              {formatCurrency(revenueData.totalRevenue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {revenueData.totalOrders === 0
                ? 'No completed orders'
                : `${revenueData.totalOrders} completed order${revenueData.totalOrders > 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
