export function interpolateQuery(sql: string, params: unknown[]): string {
  return sql.replace(/\$(\d+)/g, (_, index) => {
    const param = params[parseInt(index) - 1];

    if (typeof param === 'string') {
      return `'${param.replace(/'/g, "''")}'`; // Escape single quotes
    }

    if (param instanceof Date) {
      return `'${param.toISOString()}'`;
    }

    if (param === null || param === undefined) {
      return 'NULL';
    }
    return param.toString();
  });
}
