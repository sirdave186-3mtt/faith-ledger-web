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
export async function appendInflowToGoogleSheet(record: {
    id?: string;
    service_date: string;
    service_type: string;
    tithe: number;
    offering: number;
    thanksgiving: number;
    seed: number;
    other_inflows: number;
    total_inflow: number;
    yypc_remittance: number;
    net_inflow: number;
    recorded_by?: string;
    notes?: string | null;
}) {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    // Formats service type cleanly for the sheet (e.g., "Sunday 1st Service")
    const formatServiceType = (type: string) => {
        switch (type) {
            case 'sunday_first':
                return 'Sunday 1st Service';
            case 'sunday_second':
                return 'Sunday 2nd Service';
            case 'midweek':
                return 'Midweek Service';
            case 'special':
                return 'Special Program';
            default:
                return type.replace(/_/g, ' ');
        }
    };

    const row = [
        record.id || `TX-${Date.now().toString().slice(-6)}`, // Column A: Transaction ID
        record.service_date,                                   // Column B: Date
        formatServiceType(record.service_type),                // Column C: Service Type
        record.tithe || 0,                                     // Column D: Tithe (NGN)
        record.offering || 0,                                  // Column E: Offering (NGN)
        record.thanksgiving || 0,                              // Column F: Thanksgiving (NGN)
        record.seed || 0,                                      // Column G: Seed (NGN)
        record.other_inflows || 0,                             // Column H: Other Inflows (NGN)
        record.total_inflow || 0,                              // Column I: Total Inflow (NGN)
        record.yypc_remittance || 0,                           // Column J: YYPC Remittance (NGN)
        record.net_inflow || 0,                                // Column K: Net Inflow (NGN)
        record.recorded_by || 'Admin 1',                       // Column L: Recorded By
        record.notes || '',                                    // Column M: Notes
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'INCOME_LEDGER!A:M',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [row],
        },
    });
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