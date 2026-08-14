const KNOWN_SUBTITLE_FORMATS = new Set([
  "srt",
  "ass",
  "ssa",
  "sub",
  "vtt",
  "ttml",
  "smi",
  "sbv",
]);

/**
 * 从字幕文件名解析真实字幕格式。
 *
 * OpenSubtitles 搜索响应的 `files[].file_name` 常常是「发布名/文件基名」而非带
 * 字幕扩展名的完整文件名（例如 `wmt-matrix-revisid.eng`，真实下载文件是
 * `wmt-matrix-revisid.eng.srt`）。因此这里只信任已知字幕扩展名，其余一律回退
 * `srt`，避免把 codec / 组名 / 语言标签（`eng`、`25r`、`mx]`、`forum`）误判为格式。
 */
export function resolveSubtitleFormat(
  fileName: string | null | undefined,
): string {
  if (!fileName) return "srt";
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "srt";
  const extension = fileName.slice(lastDot + 1).toLowerCase();
  return KNOWN_SUBTITLE_FORMATS.has(extension) ? extension : "srt";
}
