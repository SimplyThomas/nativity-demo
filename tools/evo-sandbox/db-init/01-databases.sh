#!/bin/bash
# Both Evolution CMS instances share one server, one database each.
#
# MARIADB_DATABASE creates evo14 and grants the sandbox user on it; evo35 has to
# be created here. This is a shell script rather than plain SQL so the GRANT
# honours whatever DB_USER the .env sets, instead of hardcoding a name that
# would silently drift.
#
# 1.4.18 installs its tables as utf8_general_ci and 3.5.7 as
# utf8mb4_unicode_520_ci; each installer sets its own table collation, so the
# database default below only affects anything created outside them.
set -eu

mariadb --protocol=socket -uroot -p"${MARIADB_ROOT_PASSWORD}" <<-SQL
	CREATE DATABASE IF NOT EXISTS \`evo35\`
	  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci;
	GRANT ALL PRIVILEGES ON \`evo35\`.* TO '${MARIADB_USER}'@'%';
	FLUSH PRIVILEGES;
SQL

echo "[ntgoc] created database evo35 and granted ${MARIADB_USER}"
