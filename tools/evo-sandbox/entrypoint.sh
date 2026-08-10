#!/bin/sh
# Shared entrypoint for both Evolution CMS services.
#
# Four steps, then Apache: populate the webroot volume, wait for the database,
# install once, seed. Branches on $EVO_MAJOR, because the two versions' CLI
# installers share no argument names at all.
set -eu

WEBROOT=/var/www/html
SRC=/usr/src/evo

log() { echo "[ntgoc] $*" >&2; }
die() { log "FATAL: $*"; exit 1; }

# EVO writes caches, config and uploads back into its own tree, so the webroot
# has to belong to www-data. Four paths inside it are read-only bind mounts of
# repository files; chown -R over them fails, and under `set -e` that kills the
# container. They are pruned by name rather than the whole thing being made
# non-fatal, so an unexpected ownership failure anywhere else still stops boot.
take_ownership() {
    find "$WEBROOT" \
        -path "$WEBROOT/assets/templates/common" -prune -o \
        -path "$WEBROOT/assets/templates/ntgoc/img" -prune -o \
        -path "$WEBROOT/assets/templates/t05.css" -prune -o \
        -path "$WEBROOT/assets/templates/custom.css" -prune -o \
        -exec chown www-data:www-data {} +
}

# ---------------------------------------------------------------- 1. webroot
# The webroot is a named volume so manager edits survive a restart. The image
# stages its copy in /usr/src/evo and we populate on first boot, rather than
# relying on Docker's implicit volume seeding, which is easy to misread.
if [ ! -f "$WEBROOT/index.php" ]; then
    log "populating webroot from image (EVO major $EVO_MAJOR)"
    cp -a "$SRC/." "$WEBROOT/"
fi

# EVO ships its rewrite rules as ht.access, not .htaccess, so they are inert
# until renamed. Both versions install with friendly URLs on and 301 /index.php
# ?id=N to /alias, which Apache then 404s if the rules are not live.
if [ ! -f "$WEBROOT/.htaccess" ] && [ -f "$WEBROOT/ht.access" ]; then
    log "activating ht.access as .htaccess"
    cp "$WEBROOT/ht.access" "$WEBROOT/.htaccess"
fi

take_ownership

# ---------------------------------------------------------------- 2. database
log "waiting for database ${DB_HOST}/${DB_NAME}"
i=0
until php -r '
    $dsn = sprintf("mysql:host=%s;dbname=%s", getenv("DB_HOST"), getenv("DB_NAME"));
    try { new PDO($dsn, getenv("DB_USER"), getenv("DB_PASS")); } catch (Exception $e) { exit(1); }
' 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -ge 60 ] && die "database never became reachable after 120s"
    sleep 2
done
log "database is up"

# ---------------------------------------------------------------- 3. install
#
# "Is it installed?" is asked of the database, not of a config file. Both
# versions write their config before running migrations, so a config file
# proves only that an install was *attempted* — after a failure it is present
# and the CMS has no tables, and a file-based check would skip the installer
# forever and leave the container crash-looping in the seeder.
installed() {
    php -r '
        try {
            $pdo = new PDO(
                sprintf("mysql:host=%s;dbname=%s", getenv("DB_HOST"), getenv("DB_NAME")),
                getenv("DB_USER"), getenv("DB_PASS")
            );
            $table = getenv("DB_PREFIX") . "site_templates";
            $found = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetchColumn();
            exit($found === false ? 1 : 0);
        } catch (Exception $e) { exit(1); }
    ' 2>/dev/null
}

if installed; then
    log "already installed — skipping installer"
else
    log "running Evolution CMS $EVO_MAJOR.x CLI installer"

    # 3.5.7's installer drops to interactive readline() when an argument is
    # missing or invalid (install/cli-install.php:245, :301). In a container
    # that is an unkillable hang, so stdin is closed and the whole thing is
    # bounded by timeout: a bad argument becomes a fast, loud failure.
    if [ "$EVO_MAJOR" = "1" ]; then
        timeout 300 php "$WEBROOT/install/cli-install.php" \
            --database_server="$DB_HOST" \
            --database="$DB_NAME" \
            --database_user="$DB_USER" \
            --database_password="$DB_PASS" \
            --table_prefix="$DB_PREFIX" \
            --cmsadmin="$EVO_ADMIN" \
            --cmsadminemail="$EVO_ADMIN_EMAIL" \
            --cmspassword="$EVO_ADMIN_PASSWORD" \
            --language=en \
            --mode=new \
            `# NOT --installData=n, despite that being what the file's own
             # usage comment shows. cli-install.php:110 reads
             #   if ($installData == 'y') { $installData = 1; }
             # and everything downstream tests "if ($installData)". The string
             # 'n' is truthy, so asking for no demo data installs the demo
             # site. '0' is falsy and actually means no.` \
            --installData=0 \
            --removeInstall="${EVO_REMOVE_INSTALL:-y}" </dev/null || die "1.4 installer failed or timed out"
    else
        # Run from inside install/: initEvo() does `include '../index.php'`, a
        # relative path, so the installer only works with that as the working
        # directory. 1.4's installer resolves its own path and does not care.
        cd "$WEBROOT/install"
        timeout 600 php cli-install.php \
            --typeInstall=1 \
            --databaseType=mysql \
            --databaseServer="$DB_HOST" \
            --database="$DB_NAME" \
            --databaseUser="$DB_USER" \
            --databasePassword="$DB_PASS" \
            --tablePrefix="$DB_PREFIX" \
            --cmsAdmin="$EVO_ADMIN" \
            --cmsAdminEmail="$EVO_ADMIN_EMAIL" \
            --cmsPassword="$EVO_ADMIN_PASSWORD" \
            --language=en \
            --removeInstall="${EVO_REMOVE_INSTALL:-y}" </dev/null || die "3.x installer failed or timed out"
    fi

    cd "$WEBROOT"
    installed || die "installer exited cleanly but created no ${DB_PREFIX}site_templates table"
    log "installed"
fi

take_ownership

# ---------------------------------------------------------------- 4. seed
if [ "${NTGOC_SEED:-y}" = "y" ]; then
    php /opt/ntgoc/seed.php || die "seeding failed"
fi

log "starting: $*"
exec "$@"
