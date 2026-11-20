import type { MigrationInterface, QueryRunner } from 'typeorm'

/** Fuel-ups: each one also wrote an odometer reading (reading_id), in the same transaction. */
export class FuelUps1763800000000 implements MigrationInterface {
  name = 'FuelUps1763800000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE fuel_ups (
        id uuid PRIMARY KEY,
        asset_id uuid NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
        reading_id uuid NOT NULL REFERENCES readings (id) ON DELETE CASCADE,
        at timestamptz NOT NULL,
        odometer_km double precision NOT NULL CHECK (odometer_km >= 0),
        litres double precision NOT NULL CHECK (litres > 0),
        cost numeric(12, 2) NOT NULL CHECK (cost >= 0),
        full_tank boolean NOT NULL
      )`)
    await q.query(`CREATE INDEX ix_fuel_ups_asset ON fuel_ups (asset_id, odometer_km)`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE fuel_ups`)
  }
}
