import { describe, expect, test } from "bun:test";

import {
  eachStatement,
  parseMysqlDump,
  parseTuples,
} from "@/lib/import/mysql-dump";

const DUMP = `-- MySQL dump 10.13  Distrib 8.0.36
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;

--
-- Table structure for table \`users\`
--

DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`name_first\` varchar(191) DEFAULT NULL,
  \`root_admin\` tinyint unsigned NOT NULL DEFAULT '0',
  \`created_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

LOCK TABLES \`users\` WRITE;
/*!40000 ALTER TABLE \`users\` DISABLE KEYS */;
INSERT INTO \`users\` VALUES (1,'admin@example.com','O\\'Brien; Jr',1,'2024-03-01 12:30:00'),(2,'b@example.com',NULL,0,NULL);
INSERT INTO \`users\` VALUES (3,'c@example.com','It''s -- fine',0,'0000-00-00 00:00:00');
/*!40000 ALTER TABLE \`users\` ENABLE KEYS */;
UNLOCK TABLES;

CREATE TABLE \`activity_logs\` (
  \`id\` bigint NOT NULL
);
INSERT INTO \`activity_logs\` VALUES (this is not valid and must be skipped);

CREATE TABLE \`eggs\` (
  \`id\` int NOT NULL,
  \`config_files\` text,
  \`script_install\` text
);
INSERT INTO \`eggs\` (\`id\`, \`config_files\`, \`script_install\`) VALUES
(7, _binary '{"a":"b"}', '#!/bin/bash\\napt update\\r\\n\\techo \\\\ok');
`;

describe("eachStatement", () => {
  test("ignores semicolons inside strings and comments", () => {
    const parts: string[] = [];
    eachStatement(
      "SELECT 'a;b'; -- x;y\nSELECT \"c;\"; /* ; */ SELECT 1",
      (s) => {
        parts.push(s);
      }
    );
    expect(parts.map((s) => s.trim())).toEqual([
      "SELECT 'a;b'",
      '-- x;y\nSELECT "c;"',
      "/* ; */ SELECT 1",
    ]);
  });
});

describe("parseTuples", () => {
  test("unescapes strings and types bare values", () => {
    expect(
      parseTuples(String.raw`(1,'a\'b','x''y',NULL,-2.5,'\\n'),(0x6869,'')`)
    ).toEqual([
      [1, "a'b", "x'y", null, -2.5, "\\n"],
      ["hi", ""],
    ]);
  });
});

describe("parseMysqlDump", () => {
  const tables = parseMysqlDump(DUMP, new Set(["users", "eggs"]));

  test("maps rows to columns with schema types", () => {
    expect(tables.get("users")).toEqual([
      {
        created_at: new Date("2024-03-01T12:30:00Z"),
        email: "admin@example.com",
        id: 1,
        name_first: "O'Brien; Jr",
        root_admin: 1,
      },
      {
        created_at: null,
        email: "b@example.com",
        id: 2,
        name_first: null,
        root_admin: 0,
      },
      {
        created_at: null,
        email: "c@example.com",
        id: 3,
        name_first: "It's -- fine",
        root_admin: 0,
      },
    ]);
  });

  test("uses INSERT column lists and decodes escapes", () => {
    expect(tables.get("eggs")).toEqual([
      {
        config_files: '{"a":"b"}',
        id: 7,
        script_install: "#!/bin/bash\napt update\r\n\techo \\ok",
      },
    ]);
  });

  test("skips tables that were not asked for", () => {
    expect(tables.has("activity_logs")).toBe(false);
  });

  test("keeps bare numbers as numbers without a CREATE TABLE", () => {
    const rows = parseMysqlDump(
      "INSERT INTO `nests` (`id`,`name`) VALUES (4,'Minecraft');",
      new Set(["nests"])
    );
    expect(rows.get("nests")).toEqual([{ id: 4, name: "Minecraft" }]);
  });

  test("rejects INSERTs it cannot name columns for", () => {
    expect(() =>
      parseMysqlDump("INSERT INTO `nests` VALUES (4,'x');", new Set(["nests"]))
    ).toThrow(/no column list/u);
  });
});
