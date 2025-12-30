-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
-- Create production database if it doesn't exist
-- Note: Cloud SQL creates the 'postgres' database by default.
-- We can create our app database here.
CREATE DATABASE sam_prod;