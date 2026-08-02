import { parseISO, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
const date = parseISO('2026-06-01');
console.log('Parsed UTC date:', date);
const monthStart = startOfMonth(date);
const monthEnd = endOfMonth(date);
console.log('Start:', monthStart);
console.log('End:', monthEnd);
const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
console.log('First day:', format(allDays[0], 'yyyy-MM-dd'));
