import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
  content: text('content').notNull().default(''), version: integer('version').notNull().default(1), updated: integer('updated').notNull()
}, table => [index('documents_owner').on(table.owner)]);
export const shares = sqliteTable('shares', {
  document: text('document').notNull().references(() => documents.id, {onDelete: 'cascade'}), user: text('user').notNull()
}, table => [primaryKey({columns: [table.document, table.user]}), index('shares_user').on(table.user)]);
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(), user: text('user').notNull(), expires: integer('expires').notNull()
});
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), name: text('name').notNull()
});
export const loginChallenges = sqliteTable('login_challenges', {
  nonce: text('nonce').primaryKey(), expires: integer('expires').notNull()
});
