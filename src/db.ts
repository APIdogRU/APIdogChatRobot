import mysql from 'mysql';

/**
 * говнокод
 */
export const query = async <T>(database: mysql.Connection, sql: string, args?: (string | number)[]) => new Promise<T[]>((resolve, reject) => {
	database.query(sql, args, (error: mysql.MysqlError, results: T[]) => {
		if (error) {
			reject(error);
		}
		resolve(results);
	});
});
