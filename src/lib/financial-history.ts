export interface ClientRevenueSnapshot {
  id: string;
  name?: string;
  created_at: string;
  due_date: string;
  plan_id: string | null;
  plans: {
    price: number | null;
    duration_months: number;
  } | null;
}

export interface MonthlyFinancialPoint {
  name: string;
  received: number;
  pending: number;
}

export interface LegacyRevenueBreakdown {
  total: number;
  byMonth: Record<string, number>;
}

export interface LegacyPaymentEntry {
  id: string;
  client_id: string;
  client_name: string;
  amount: number;
  due_date: string;
  payment_date: string;
  status: "paid";
  source: "legacy";
}

const AVERAGE_DAYS_PER_MONTH = 30.4375;

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sumByMonth = (target: Record<string, number>, monthKey: string, amount: number) => {
  target[monthKey] = (target[monthKey] ?? 0) + amount;
};

export const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1, 12);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(".", "");
};

export const addMonthsSafe = (date: Date, monthsToAdd: number) => {
  const result = new Date(date);
  const day = result.getDate();

  result.setHours(12, 0, 0, 0);
  result.setDate(1);
  result.setMonth(result.getMonth() + monthsToAdd);

  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDayOfMonth));

  return result;
};

export const buildLegacyPaidEntries = (clients: ClientRevenueSnapshot[], cutoffDate: Date) => {
  const entries: LegacyPaymentEntry[] = [];

  for (const client of clients) {
    const price = Number(client.plans?.price ?? 0);
    const durationMonths = Math.max(Number(client.plans?.duration_months ?? 1), 1);

    if (!price || !client.created_at) continue;

    const startDate = new Date(client.created_at);
    startDate.setHours(12, 0, 0, 0);

    const dueDate = client.due_date ? new Date(`${client.due_date}T12:00:00`) : null;

    if (Number.isNaN(startDate.getTime()) || startDate > cutoffDate) continue;

    const cycleLengthInDays = durationMonths * AVERAGE_DAYS_PER_MONTH;
    const elapsedDaysUntilCutoff = Math.max(0, (cutoffDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const maxPossibleCycles = Math.max(1, Math.floor(elapsedDaysUntilCutoff / cycleLengthInDays) + 1);

    const estimatedCyclesFromDueDate = dueDate && !Number.isNaN(dueDate.getTime())
      ? Math.max(1, Math.round(((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) / cycleLengthInDays))
      : 1;

    const paidCycles = Math.min(maxPossibleCycles, estimatedCyclesFromDueDate);

    for (let cycleIndex = 0; cycleIndex < paidCycles; cycleIndex += 1) {
      const paymentDate = addMonthsSafe(startDate, cycleIndex * durationMonths);
      if (paymentDate > cutoffDate) break;

      const paymentDay = formatIsoDate(paymentDate);

      entries.push({
        id: `legacy-${client.id}-${cycleIndex}`,
        client_id: client.id,
        client_name: client.name ?? "—",
        amount: price,
        due_date: paymentDay,
        payment_date: `${paymentDay}T12:00:00`,
        status: "paid",
        source: "legacy",
      });
    }
  }

  return entries;
};

export const calculateLegacyRevenueBreakdown = (clients: ClientRevenueSnapshot[], cutoffDate: Date) => {
  const byMonth: Record<string, number> = {};
  let total = 0;

  for (const entry of buildLegacyPaidEntries(clients, cutoffDate)) {
    total += entry.amount;
    sumByMonth(byMonth, getMonthKey(new Date(entry.payment_date)), entry.amount);
  }

  return { total, byMonth } satisfies LegacyRevenueBreakdown;
};

export const buildMonthlyFinancialChart = (
  receivedByMonth: Record<string, number>,
  pendingByMonth: Record<string, number>,
  currentMonthKey: string,
) => {
  const availableMonths = [...new Set([...Object.keys(receivedByMonth), ...Object.keys(pendingByMonth), currentMonthKey])].sort();

  if (availableMonths.length === 0) {
    return [] as MonthlyFinancialPoint[];
  }

  const [startKey, endKey] = [availableMonths[0], availableMonths[availableMonths.length - 1]];
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);
  const months: string[] = [];
  const cursor = new Date(startYear, startMonth - 1, 1, 12);
  const end = new Date(endYear, endMonth - 1, 1, 12);

  while (cursor <= end) {
    months.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months.map((monthKey) => ({
    name: formatMonthLabel(monthKey),
    received: receivedByMonth[monthKey] ?? 0,
    pending: pendingByMonth[monthKey] ?? 0,
  }));
};