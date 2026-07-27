import { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType } from "docx";

const headerShading = {
  fill: "D9EAD3",
  type: ShadingType.CLEAR,
  color: "auto"
};

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};
