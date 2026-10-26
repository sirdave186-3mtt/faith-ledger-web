import { google } from 'googleapis';

// Interface matching the Supabase expense requisition schema
export interface DisbursedExpensePayload {
    requestId: string;
    date: string;
    sundayServiceTag: string;
    category: 'allowances' | 'welfare' | 'utilities' | 'fuel' | 'capital_special';
    description: string;
    amount: number;
    complianceSignoff: string;
    executiveApprovedBy: string;
    disbursedBy: string;
    receiptDriveUrl?: string;
    status: string;
}

// Interface matching the Supabase inflow records schema
export interface InflowRecordPayload {
    transactionId: string;
    date: string;
    serviceType: string;
    tithe: number;
    offering: number;
    thanksgiving: number;
    seed: number;
    otherInflows: number;
    yypcRemittance: number;
    recordedBy: string;
    notes?: string;
}

/**
 * Initializes Google Sheets API authenticated via Service Account
 */
function getGoogleSheetsClient() {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!privateKey || !clientEmail) {
        throw new Error('Missing Google Service Account credentials in environment variables.');
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

/**
 * Appends a newly disbursed expense to the EXPENSE_REQUISITIONS sheet
 * (Invoked once Treasurer 1 or 2 completes Rule 4 in the app)
 */
export async function appendExpenseToGoogleSheet(
    spreadsheetId: string,
    expense: DisbursedExpensePayload
) {
    const sheets = getGoogleSheetsClient();

    const row = [
        expense.requestId,
        expense.date,
        expense.sundayServiceTag,
        expense.category.toUpperCase(),
        expense.description,
        expense.amount,
        expense.complianceSignoff,
        expense.executiveApprovedBy,
        expense.disbursedBy,
        expense.receiptDriveUrl || '',
        expense.status,
    ];

    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'EXPENSE_REQUISITIONS!A:K',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [row],
        },
    });

    return response.data;
}

/**
 * Appends a recorded service income to the INCOME_LEDGER sheet
 */
export async function appendInflowToGoogleSheet(
    spreadsheetId: string,
    inflow: InflowRecordPayload
) {
    const sheets = getGoogleSheetsClient();

    // Columns: Transaction ID, Date, Service Type, Tithe, Offering, Thanksg, Seed, Other, Total(formula), YYPC, Net(formula), RecordedBy, Notes
    const row = [
        inflow.transactionId,
        inflow.date,
        inflow.serviceType,
        inflow.tithe,
        inflow.offering,
        inflow.thanksgiving,
        inflow.seed,
        inflow.otherInflows,
        `=SUM(D${'{row}'}:H${'{row}'})`, // Injected via formula or direct user-entered
        inflow.yypcRemittance,
        `=I${'{row}'}-J${'{row}'}`,
        inflow.recordedBy,
        inflow.notes || '',
    ];

    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'INCOME_LEDGER!A:M',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [row],
        },
    });

    return response.data;
}

/**
 * Pulls current monthly totals from MONTHLY_SUMMARY for the in-app dashboard
 */
export async function fetchMonthlySummaryFromSheet(spreadsheetId: string) {
    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'MONTHLY_SUMMARY!A2:B6',
    });

    return response.data.values || [];
}
export interface AttendanceRecordPayload {
    date: string;
    serviceTitle: string;
    men: number;
    women: number;
    children: number;
    totalAttendance: number;
    firstTimers: number;
    notes?: string;
}

/**
 * Appends a service attendance headcount to the ATTENDANCE_METRICS sheet
 */
export async function appendAttendanceToGoogleSheet(
    spreadsheetId: string,
    attendance: AttendanceRecordPayload
) {
    const sheets = getGoogleSheetsClient();

    // Columns: Date, Service Title, Men, Women, Children, Total Attendance (formula), First Timers, Notes
    const row = [
        attendance.date,
        attendance.serviceTitle,
        attendance.men,
        attendance.women,
        attendance.children,
        attendance.totalAttendance,
        attendance.firstTimers,
        attendance.notes || '',
    ];

    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'ATTENDANCE_METRICS!A:H',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: [row],
        },
    });

    return response.data;
}