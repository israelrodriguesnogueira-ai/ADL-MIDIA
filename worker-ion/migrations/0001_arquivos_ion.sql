CREATE TABLE arquivos_ion (
  chave TEXT PRIMARY KEY NOT NULL,
  dados BLOB NOT NULL CHECK (length(dados) <= 1500000),
  tipo TEXT,
  expira TEXT
);
