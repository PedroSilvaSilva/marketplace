import logger from '@config/logger';

/**
 * CSV Chunker - Splits CSV data into chunks respecting size limits
 * TypsForYou API limit: 500KB per file
 */
export class CsvChunker {
  private static readonly MAX_FILE_SIZE_BYTES = 400 * 1024; // 400KB (safety margin)
  private static readonly BYTES_PER_KB = 1024;

  /**
   * Split CSV rows into chunks that respect size limit
   * @param rows Array of CSV row strings
   * @param maxSizeBytes Maximum size per chunk in bytes (default 400KB)
   * @returns Array of CSV chunks (each chunk is a string with multiple rows)
   */
  static chunkCsvRows(
    rows: string[],
    maxSizeBytes: number = this.MAX_FILE_SIZE_BYTES
  ): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;

    for (const row of rows) {
      // Calculate row size in bytes (UTF-8)
      const rowSize = Buffer.byteLength(row + '\n', 'utf-8');

      // Check if adding this row would exceed limit
      if (currentSize + rowSize > maxSizeBytes && currentChunk.length > 0) {
        // Save current chunk and start new one
        chunks.push(currentChunk.join('\n'));
        logger.info('CSV chunk created', {
          rows: currentChunk.length,
          sizeKB: (currentSize / this.BYTES_PER_KB).toFixed(2)
        });

        currentChunk = [];
        currentSize = 0;
      }

      // Add row to current chunk
      currentChunk.push(row);
      currentSize += rowSize;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      logger.info('CSV chunk created (final)', {
        rows: currentChunk.length,
        sizeKB: (currentSize / this.BYTES_PER_KB).toFixed(2)
      });
    }

    logger.info('CSV chunking completed', {
      totalRows: rows.length,
      totalChunks: chunks.length,
      avgRowsPerChunk: Math.round(rows.length / chunks.length)
    });

    return chunks;
  }

  /**
   * Calculate size of CSV content in KB
   */
  static calculateSizeKB(content: string): number {
    const bytes = Buffer.byteLength(content, 'utf-8');
    return bytes / this.BYTES_PER_KB;
  }

  /**
   * Check if CSV content exceeds size limit
   */
  static exceedsLimit(content: string, maxSizeBytes?: number): boolean {
    const bytes = Buffer.byteLength(content, 'utf-8');
    const limit = maxSizeBytes || this.MAX_FILE_SIZE_BYTES;
    return bytes > limit;
  }

  /**
   * Estimate number of rows that fit in size limit
   * @param avgRowSizeBytes Average size of a single row in bytes
   * @param maxSizeBytes Maximum size per chunk
   */
  static estimateRowsPerChunk(
    avgRowSizeBytes: number,
    maxSizeBytes: number = this.MAX_FILE_SIZE_BYTES
  ): number {
    return Math.floor(maxSizeBytes / avgRowSizeBytes);
  }

  /**
   * Get info about CSV chunks
   */
  static getChunkInfo(chunks: string[]): {
    totalChunks: number;
    totalRows: number;
    sizes: { index: number; rows: number; sizeKB: number }[];
  } {
    const sizes = chunks.map((chunk, index) => {
      const rows = chunk.split('\n').length;
      const sizeKB = this.calculateSizeKB(chunk);
      return { index, rows, sizeKB };
    });

    return {
      totalChunks: chunks.length,
      totalRows: sizes.reduce((sum, s) => sum + s.rows, 0),
      sizes
    };
  }
}
