import { TableService } from './table.service';

import { Table } from 'typeorm';
import { DbService } from './db.service';

export class MaterializerService {
  constructor(
    private readonly tableService: TableService,
    private readonly dbService: DbService,
  ) {}

  async materialize(table_name: string) {
    const table_id = await this.tableService.getTable(table_name);

    if (!table_id) {
      throw new Error(`Could not find the table '${table_name}'`);
    }

    const columns = await this.tableService.listColumns(table_id);
    const rows = await this.tableService.listRows(table_id);

    const queryRunner = this.dbService.dataSource.createQueryRunner();

    const new_table_name = table_name.split('.')[0];

    const table = await queryRunner.getTable(new_table_name);
    if (!table) {
      await queryRunner.createTable(
        new Table({
          name: new_table_name.split('.')[0],
          columns: [
            ...columns.map((col) => {
              return {
                name: JSON.parse(
                  col.propertyKeys[0].propertyValue.property_value,
                ).value,
                type: 'varchar',
                length: '255',
              };
            }),
            {
              name: 'created_at',
              type: 'timestamp with time zone',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updated_at',
              type: 'timestamp with time zone',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
      );
    }
    for (const row of rows) {
      const rowData = [];
      for (const column of columns) {
        const data = await this.tableService.readCell(column.id, row.id);
        rowData.push(`'${data}'`);
      }

      await queryRunner.query(
        `INSERT INTO '${new_table_name}' (${columns
          .map((col) => {
            return JSON.parse(col.propertyKeys[0].propertyValue.property_value)
              .value;
          })
          .join(',')})
        VALUES (${rowData.join(',')})`,
      );
    }
  }
}
