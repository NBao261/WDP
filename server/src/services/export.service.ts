import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';
import path from 'path';

const FONT_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Bold.ttf');

interface RevenueTimePeriod {
  label: string;
  totalRevenue: number;
  transactionCount: number;
  avgRevenue: number;
}

interface RevenueMethod {
  method: string;
  totalRevenue: number;
  count: number;
}

interface RevenueReportData {
  byTimePeriod?: RevenueTimePeriod[];
  byMethod?: RevenueMethod[];
}

interface TrafficRow {
  label: string;
  checkIn: number;
  checkOut: number;
}

interface TrafficReportData {
  data?: TrafficRow[];
}

interface OccupancyRow {
  facilityName: string;
  floorName: string;
  total: number;
  occupied: number;
  available: number;
  occupancyRate: number;
}

interface OccupancyReportData {
  floors?: OccupancyRow[];
}

interface PeakHourRow {
  label: string;
  checkIn: number;
  checkOut: number;
  totalActivity: number;
}

interface PeakHoursReportData {
  hourlyDistribution?: PeakHourRow[];
}

interface ComprehensiveReportData {
  revenue: RevenueReportData;
  traffic: TrafficReportData;
  occupancy: OccupancyReportData;
  peakHours: PeakHoursReportData;
}

type ReportData = RevenueReportData | TrafficReportData | OccupancyReportData | PeakHoursReportData;

const TABLE_OPTIONS = {
  prepareHeader: function(this: any) { this.font('Roboto-Bold').fontSize(8); },
  prepareRow: function(this: any) { this.font('Roboto').fontSize(8); },
};

const makeTitle = (label: string) => ({
  label,
  fontFamily: 'Roboto-Bold',
  fontSize: 12,
});

export class ExportService {
  static async generateReport(reportType: string, format: string, data: any): Promise<Buffer> {
    if (format === 'excel') {
      return this.generateExcel(reportType, data);
    } else if (format === 'pdf') {
      return this.generatePdf(reportType, data);
    }
    throw new Error('Unsupported format');
  }

  static async generateComprehensiveReport(format: string, data: ComprehensiveReportData): Promise<Buffer> {
    if (format === 'excel') {
      return this.generateComprehensiveExcel(data);
    } else if (format === 'pdf') {
      return this.generateComprehensivePdf(data);
    }
    throw new Error('Unsupported format');
  }

  private static async generateComprehensiveExcel(data: ComprehensiveReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Parking System';

    const styleHeader = (sheet: ExcelJS.Worksheet) => {
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      headerRow.height = 28;
    };

    const revenueSheet = workbook.addWorksheet('Doanh Thu');
    revenueSheet.columns = [
      { header: 'Thời gian', key: 'label', width: 20 },
      { header: 'Tổng doanh thu (VNĐ)', key: 'totalRevenue', width: 22 },
      { header: 'Số giao dịch', key: 'transactionCount', width: 15 },
      { header: 'Trung bình/Giao dịch', key: 'avgRevenue', width: 22 },
    ];
    data.revenue?.byTimePeriod?.forEach((row: any) => revenueSheet.addRow(row));
    styleHeader(revenueSheet);

    const methodSheet = workbook.addWorksheet('Theo Hình Thức TT');
    methodSheet.columns = [
      { header: 'Phương thức', key: 'method', width: 20 },
      { header: 'Tổng doanh thu (VNĐ)', key: 'totalRevenue', width: 22 },
      { header: 'Số giao dịch', key: 'count', width: 15 },
    ];
    data.revenue?.byMethod?.forEach((row: any) => methodSheet.addRow(row));
    styleHeader(methodSheet);

    const trafficSheet = workbook.addWorksheet('Lượt Xe Vào Ra');
    trafficSheet.columns = [
      { header: 'Thời gian', key: 'label', width: 20 },
      { header: 'Xe vào', key: 'checkIn', width: 15 },
      { header: 'Xe ra', key: 'checkOut', width: 15 },
    ];
    data.traffic?.data?.forEach((row: any) => trafficSheet.addRow(row));
    styleHeader(trafficSheet);

    const occupancySheet = workbook.addWorksheet('Tỷ Lệ Lấp Đầy');
    occupancySheet.columns = [
      { header: 'Bãi xe', key: 'facilityName', width: 25 },
      { header: 'Tầng', key: 'floorName', width: 20 },
      { header: 'Tổng slot', key: 'total', width: 12 },
      { header: 'Đang dùng', key: 'occupied', width: 12 },
      { header: 'Đã đặt', key: 'reserved', width: 12 },
      { header: 'Trống', key: 'available', width: 12 },
      { header: 'Tỷ lệ lấp đầy (%)', key: 'occupancyRate', width: 20 },
    ];
    data.occupancy?.floors?.forEach((row: any) => occupancySheet.addRow(row));
    styleHeader(occupancySheet);

    const peakSheet = workbook.addWorksheet('Khung Giờ Cao Điểm');
    peakSheet.columns = [
      { header: 'Khung giờ', key: 'label', width: 22 },
      { header: 'Xe vào', key: 'checkIn', width: 12 },
      { header: 'Xe ra', key: 'checkOut', width: 12 },
      { header: 'Tổng hoạt động', key: 'totalActivity', width: 18 },
    ];
    data.peakHours?.hourlyDistribution?.forEach((row: any) => peakSheet.addRow(row));
    styleHeader(peakSheet);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private static async generateComprehensivePdf(data: ComprehensiveReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.registerFont('Roboto', FONT_REGULAR);
      doc.registerFont('Roboto-Bold', FONT_BOLD);

      doc.font('Roboto-Bold').fontSize(18).text('BÁO CÁO TỔNG HỢP', { align: 'center' });
      doc.font('Roboto').fontSize(10).text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, { align: 'center' });
      doc.moveDown(1.5);

      if (data.revenue?.byTimePeriod && data.revenue.byTimePeriod.length > 0) {
        const table1 = {
          title: makeTitle("1. DOANH THU THEO THỜI GIAN"),
          headers: ["Thời gian", "Tổng doanh thu", "Giao dịch", "Trung bình"],
          rows: data.revenue.byTimePeriod.map((r: any) => [r.label, String(r.totalRevenue), String(r.transactionCount), String(r.avgRevenue)])
        };
        doc.table(table1, { width: 500, ...TABLE_OPTIONS });
        doc.moveDown();
      }

      if (data.revenue?.byMethod && data.revenue.byMethod.length > 0) {
        const table2 = {
          title: makeTitle("2. DOANH THU THEO HÌNH THỨC THANH TOÁN"),
          headers: ["Phương thức", "Tổng doanh thu", "Số giao dịch"],
          rows: data.revenue.byMethod.map((r: any) => [r.method, String(r.totalRevenue), String(r.count)])
        };
        doc.table(table2, { width: 500, ...TABLE_OPTIONS });
        doc.moveDown();
      }

      if (data.traffic?.data && data.traffic.data.length > 0) {
        const table3 = {
          title: makeTitle("3. LƯỢT XE VÀO RA"),
          headers: ["Thời gian", "Xe vào", "Xe ra"],
          rows: data.traffic.data.map((r: any) => [r.label, String(r.checkIn), String(r.checkOut)])
        };
        doc.table(table3, { width: 500, ...TABLE_OPTIONS });
        doc.moveDown();
      }

      if (data.occupancy?.floors && data.occupancy.floors.length > 0) {
        const table4 = {
          title: makeTitle("4. TỶ LỆ LẤP ĐẦY"),
          headers: ["Bãi xe", "Tầng", "Tổng", "Đang dùng", "Trống", "Tỷ lệ (%)"],
          rows: data.occupancy.floors.map((r: any) => [r.facilityName, r.floorName, String(r.total), String(r.occupied), String(r.available), String(r.occupancyRate)])
        };
        doc.table(table4, { width: 500, ...TABLE_OPTIONS });
        doc.moveDown();
      }

      if (data.peakHours?.hourlyDistribution && data.peakHours.hourlyDistribution.length > 0) {
        const table5 = {
          title: makeTitle("5. KHUNG GIỜ CAO ĐIỂM"),
          headers: ["Giờ", "Xe vào", "Xe ra", "Tổng"],
          rows: data.peakHours.hourlyDistribution.map((r: any) => [r.label, String(r.checkIn), String(r.checkOut), String(r.totalActivity)])
        };
        doc.table(table5, { width: 500, ...TABLE_OPTIONS });
      }

      doc.end();
    });
  }

  private static async generateExcel(reportType: string, data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smart Parking System';
    
    if (reportType === 'revenue') {
      const sheet = workbook.addWorksheet('Doanh Thu');
      sheet.columns = [
        { header: 'Thời gian', key: 'label', width: 20 },
        { header: 'Tổng doanh thu', key: 'totalRevenue', width: 20 },
        { header: 'Số giao dịch', key: 'transactionCount', width: 15 },
        { header: 'Trung bình/Giao dịch', key: 'avgRevenue', width: 25 },
      ];
      data.byTimePeriod?.forEach((row: any) => sheet.addRow(row));
      
      const methodSheet = workbook.addWorksheet('Theo Hình Thức');
      methodSheet.columns = [
        { header: 'Phương thức', key: 'method', width: 20 },
        { header: 'Tổng doanh thu', key: 'totalRevenue', width: 20 },
        { header: 'Số giao dịch', key: 'count', width: 15 },
      ];
      data.byMethod?.forEach((row: any) => methodSheet.addRow(row));
    } else if (reportType === 'traffic') {
      const sheet = workbook.addWorksheet('Lượt Xe Vào Ra');
      sheet.columns = [
        { header: 'Thời gian', key: 'label', width: 20 },
        { header: 'Xe vào', key: 'checkIn', width: 15 },
        { header: 'Xe ra', key: 'checkOut', width: 15 },
      ];
      data.data?.forEach((row: any) => sheet.addRow(row));
    } else if (reportType === 'occupancy') {
      const sheet = workbook.addWorksheet('Tỷ Lệ Lấp Đầy');
      sheet.columns = [
        { header: 'Bãi xe', key: 'facilityName', width: 25 },
        { header: 'Tầng', key: 'floorName', width: 20 },
        { header: 'Tổng slot', key: 'total', width: 15 },
        { header: 'Đang dùng', key: 'occupied', width: 15 },
        { header: 'Trống', key: 'available', width: 15 },
        { header: 'Tỷ lệ lấp đầy (%)', key: 'occupancyRate', width: 20 },
      ];
      data.floors?.forEach((row: any) => sheet.addRow(row));
    } else if (reportType === 'peak-hours') {
      const sheet = workbook.addWorksheet('Khung Giờ Cao Điểm');
      sheet.columns = [
        { header: 'Giờ', key: 'label', width: 20 },
        { header: 'Xe vào', key: 'checkIn', width: 15 },
        { header: 'Xe ra', key: 'checkOut', width: 15 },
        { header: 'Tổng hoạt động', key: 'totalActivity', width: 20 },
      ];
      data.hourlyDistribution?.forEach((row: any) => sheet.addRow(row));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }

  private static readonly REPORT_TYPE_LABELS: Record<string, string> = {
    'revenue': 'DOANH THU',
    'traffic': 'LƯỢT XE VÀO RA',
    'occupancy': 'TỶ LỆ LẤP ĐẦY',
    'peak-hours': 'KHUNG GIỜ CAO ĐIỂM',
  };

  private static async generatePdf(reportType: string, data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      doc.registerFont('Roboto', FONT_REGULAR);
      doc.registerFont('Roboto-Bold', FONT_BOLD);

      const reportLabel = this.REPORT_TYPE_LABELS[reportType] || reportType.toUpperCase();
      doc.font('Roboto-Bold').fontSize(18).text(`Báo Cáo ${reportLabel}`, { align: 'center' });
      doc.font('Roboto').fontSize(10).text(`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`, { align: 'center' });
      doc.moveDown();

      if (reportType === 'revenue' && data.byTimePeriod) {
        const table = {
          title: makeTitle("Doanh thu theo thời gian"),
          headers: ["Thời gian", "Tổng doanh thu", "Giao dịch", "Trung bình"],
          rows: data.byTimePeriod.map((r: any) => [r.label, String(r.totalRevenue), String(r.transactionCount), String(r.avgRevenue)])
        };
        doc.table(table, { width: 500, ...TABLE_OPTIONS });
      } else if (reportType === 'traffic' && data.data) {
        const table = {
          title: makeTitle("Lượt xe vào ra"),
          headers: ["Thời gian", "Xe vào", "Xe ra"],
          rows: data.data.map((r: any) => [r.label, String(r.checkIn), String(r.checkOut)])
        };
        doc.table(table, { width: 500, ...TABLE_OPTIONS });
      } else if (reportType === 'occupancy' && data.floors) {
        const table = {
          title: makeTitle("Tỷ lệ lấp đầy"),
          headers: ["Bãi xe", "Tầng", "Tổng", "Đang dùng", "Trống", "Tỷ lệ (%)"],
          rows: data.floors.map((r: any) => [r.facilityName, r.floorName, String(r.total), String(r.occupied), String(r.available), String(r.occupancyRate)])
        };
        doc.table(table, { width: 500, ...TABLE_OPTIONS });
      } else if (reportType === 'peak-hours' && data.hourlyDistribution) {
        const table = {
          title: makeTitle("Khung giờ cao điểm"),
          headers: ["Giờ", "Vào", "Ra", "Tổng"],
          rows: data.hourlyDistribution.map((r: any) => [r.label, String(r.checkIn), String(r.checkOut), String(r.totalActivity)])
        };
        doc.table(table, { width: 500, ...TABLE_OPTIONS });
      }

      doc.end();
    });
  }
}
