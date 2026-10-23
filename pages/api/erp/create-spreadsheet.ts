import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Yalnizca POST metodu destekleniyor" });
  }

  if (!verifyToken(req.headers.authorization)) {
    return res.status(401).json({ error: "Giris gerekli" });
  }

  try {
    const { filename, headers, rows, return_base64 } = req.body as {
      filename?: unknown;
      headers?: unknown;
      rows?: unknown;
      return_base64?: boolean;
    };

    if (
      typeof filename !== "string"
      || !filename.trim()
      || !Array.isArray(headers)
      || headers.length === 0
      || headers.length > 100
      || !headers.every((value) => typeof value === "string")
      || !Array.isArray(rows)
      || rows.length > 5_000
      || !rows.every((row) => Array.isArray(row) && row.length <= headers.length && row.every((value) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null))
    ) {
      return res.status(400).json({ error: "filename, headers ve rows gerekli" });
    }

    const safeCell = (value: string | number | boolean | null) => {
      if (typeof value !== "string") return value;
      const normalized = value.slice(0, 32_767);
      return /^[\s]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
    };
    const safeHeaders = (headers as string[]).map(safeCell);
    const safeRows = (rows as Array<Array<string | number | boolean | null>>).map((row) => row.map(safeCell));
    const worksheet = XLSX.utils.aoa_to_sheet([safeHeaders, ...safeRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rapor");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const safeFilename = filename.trim().slice(0, 100).replace(/[^a-zA-Z0-9-_]/g, "_") || "rapor";

    if (return_base64) {
      const base64 = buffer.toString("base64");
      const finalFilename = `${safeFilename}_${new Date().toISOString().split("T")[0]}.xlsx`;
      return res.status(200).json({
        data: {
          filename: finalFilename,
          base64,
          downloadUrl: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
        },
      });
    }

    const finalFilename = `${safeFilename}_${new Date().toISOString().split("T")[0]}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Create Spreadsheet error:", error);
    res.status(500).json({ error: "Excel olusturulurken hata olustu" });
  }
}