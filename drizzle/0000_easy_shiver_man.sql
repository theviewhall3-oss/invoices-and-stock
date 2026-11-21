CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clients_owner` ON `clients` (`owner_id`);--> statement-breakpoint
CREATE TABLE `credit_note_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`credit_note_id` text NOT NULL,
	`invoice_line_id` text NOT NULL,
	`quantity` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `credit_note_lines_note` ON `credit_note_lines` (`credit_note_id`);--> statement-breakpoint
CREATE TABLE `credit_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`subtotal` integer NOT NULL,
	`tax_total` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `credit_notes_invoice` ON `credit_notes` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`supplier_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expenses_owner` ON `expenses` (`owner_id`);--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`product_id` text,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` integer NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`invoice_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invoice_lines_invoice` ON `invoice_lines` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`issue_date` text NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`share_token` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`number` integer,
	`status` text NOT NULL,
	`due_date` text NOT NULL,
	`quote_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_share_token_unique` ON `invoices` (`share_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_quote_id_unique` ON `invoices` (`quote_id`);--> statement-breakpoint
CREATE INDEX `invoices_owner` ON `invoices` (`owner_id`);--> statement-breakpoint
CREATE INDEX `invoices_client` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`method` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payments_invoice` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`track_stock` integer DEFAULT false NOT NULL,
	`low_stock_level` real DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`bill_date` text NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`received_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_bills_owner` ON `purchase_bills` (`owner_id`);--> statement-breakpoint
CREATE TABLE `purchase_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_cost` integer NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_lines_bill` ON `purchase_lines` (`bill_id`);--> statement-breakpoint
CREATE TABLE `quote_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`product_id` text,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` integer NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`tax_rate` real DEFAULT 0 NOT NULL,
	`quote_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quote_lines_quote` ON `quote_lines` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`issue_date` text NOT NULL,
	`discount_rate` real DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`share_token` text,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`number` integer NOT NULL,
	`status` text NOT NULL,
	`expiry_date` text NOT NULL,
	`responded_at` text,
	`invoice_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_share_token_unique` ON `quotes` (`share_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_invoice_id_unique` ON `quotes` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `quotes_owner` ON `quotes` (`owner_id`);--> statement-breakpoint
CREATE INDEX `quotes_client` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`currency_code` text DEFAULT 'USD' NOT NULL,
	`default_tax_rate` real DEFAULT 0 NOT NULL,
	`payment_terms_days` integer DEFAULT 30 NOT NULL,
	`next_quote_number` integer DEFAULT 1 NOT NULL,
	`next_invoice_number` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text,
	`reason` text DEFAULT '' NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
