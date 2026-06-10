# Phase 0a — webapps/assembly split into webapp-rest — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Camunda BE persona — Java/Spring only, no compile/build (handed off to DevOps per CLAUDE.md).**

**Goal:** Extract every Java source file under `webapps/assembly/src/main/java/` into a new Maven module `webapps/webapp-rest/`, produced as a jar. `webapps/assembly` becomes a thin war that depends on the jar and contributes only the static-asset shell + `web.xml`. This is a load-bearing refactor: it unblocks Phase 5 (legacy retirement deletes the assembly war), and Phase 0c+e's webapp-REST proxy rewrites need the API surface to keep serving `/api/{cockpit,admin,tasklist,welcome}/*` after the war goes away.

**Architecture:** Git-mv every `.java` under `webapps/assembly/src/main/java/` to `webapps/webapp-rest/src/main/java/`. Move `META-INF/services/` (SPI bindings), `securityFilterRules.json`, and any other classpath resources to the new module. Move `WEB-INF/web.xml`'s servlet/filter mappings stay in assembly (they're packaging-time, not Java) but the class references inside still resolve because assembly depends on the new jar. The split is structurally invisible from the running app's perspective — same servlets, same paths, same behavior — but Maven artifacts are cleanly separated.

**Tech Stack:** Maven, Java 17, JAX-RS (RESTEasy 3), Spring Boot fat-jar (the way the Camunda Run distro packages it).

**Source spec:** `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` — §3.4 distro packaging, §6 custom webapp-REST endpoints, §7 Phase 0 deliverables, R1+R2 risks.

---

## File structure

**Created:**

- `webapps/webapp-rest/pom.xml` — new Maven module producing `camunda-webapp-rest-7.24.0-SNAPSHOT.jar`. Inherits from `webapps/pom.xml` (`camunda-webapp-root`).
- `webapps/webapp-rest/src/main/java/**` — every `.java` from `webapps/assembly/src/main/java/**` lands here, preserving package structure (`org.camunda.bpm.{webapp,cockpit,admin,tasklist,welcome}`).
- `webapps/webapp-rest/src/main/resources/**` — every classpath resource from `webapps/assembly/src/main/resources/**` lands here. **Excludes** the `webapps/assembly/src/main/webapp/` tree (web.xml + static), which stays in assembly.
- `webapps/webapp-rest/src/test/**` — Java tests + test resources, mirrored from `webapps/assembly/src/test/`.

**Modified:**

- `webapps/pom.xml` — add `<module>webapp-rest</module>` BEFORE `<module>assembly</module>` so the jar builds first.
- `webapps/assembly/pom.xml` — drop test/main java source roots (still defaults but src dirs are empty post-move); add a `<dependency>` on `camunda-webapp-rest`; keep packaging `war`.
- `webapps/assembly-jakarta/pom.xml` — same dependency add, mirrors the Java EE 9 variant.

**Not touched in this plan (will be touched in Phase 5):**

- `webapps/assembly/src/main/webapp/WEB-INF/web.xml` — servlet/filter mappings stay. They reference classes by FQN; FQNs don't change with the jar split.
- `webapps/frontend/` — independent.
- `engine-rest/` — independent.
- `distro/run/modules/webapps/pom.xml` — its `webapps` jar dependency already pulls assembly which now transitively pulls webapp-rest. No change needed.

---

## Task ordering & dependencies

```
Task 1 (create webapp-rest pom.xml + empty dirs)
  └─ Task 2 (move org.camunda.bpm.webapp.*)
       └─ Task 3 (move org.camunda.bpm.cockpit.*)
            └─ Task 4 (move org.camunda.bpm.admin.*)
                 └─ Task 5 (move org.camunda.bpm.tasklist.*)
                      └─ Task 6 (move org.camunda.bpm.welcome.*)
                           └─ Task 7 (move resources + META-INF)
                                └─ Task 8 (move test/)
                                     └─ Task 9 (update parent pom + assembly poms)
                                          └─ Task 10 (DevOps handoff — full reactor build)
                                               └─ Task 11 (DevOps handoff — distro smoke)
                                                    └─ Task 12 (commit consolidation)
```

Strictly sequential: each move task depends on the previous so the working tree stays consistent. Tasks 2–8 are mechanical `git mv` operations and can be one-commit-each so any single move that breaks something is reverted cleanly.

---

### Task 1: Create `webapps/webapp-rest/pom.xml` and empty Maven structure

**Files:**
- Create: `webapps/webapp-rest/pom.xml`
- Create: `webapps/webapp-rest/src/main/java/.gitkeep`
- Create: `webapps/webapp-rest/src/main/resources/.gitkeep`
- Create: `webapps/webapp-rest/src/test/java/.gitkeep`
- Create: `webapps/webapp-rest/src/test/resources/.gitkeep`

- [ ] **Step 1: Create the pom.xml**

`webapps/webapp-rest/pom.xml`:

```xml
<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">

  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.camunda.bpm.webapp</groupId>
    <artifactId>camunda-webapp-root</artifactId>
    <version>7.24.0-SNAPSHOT</version>
    <relativePath>../</relativePath>
  </parent>

  <artifactId>camunda-webapp-rest</artifactId>
  <packaging>jar</packaging>

  <description>
    Java REST surface for the Camunda webapps: the @Path resources, the
    AuthenticationFilter / SecurityFilter chain, the app-plugin SPI, and the
    shared cockpit/admin/tasklist/welcome runtime delegates. This module is
    consumed by the webapps assembly war and survives Phase 5 retirement of
    the AngularJS UI. No static assets here.
  </description>
  <name>Camunda Platform - Webapp - REST</name>

  <dependencies>
    <!-- jee spec (same provided scope as assembly) -->
    <dependency>
      <groupId>org.jboss.spec</groupId>
      <artifactId>jboss-javaee-6.0</artifactId>
      <type>pom</type>
      <scope>provided</scope>
      <exclusions>
        <exclusion>
          <groupId>org.jboss.spec.javax.ws.rs</groupId>
          <artifactId>jboss-jaxrs-api_1.1_spec</artifactId>
        </exclusion>
      </exclusions>
    </dependency>

    <dependency>
      <groupId>org.jboss.spec.javax.ws.rs</groupId>
      <artifactId>jboss-jaxrs-api_2.1_spec</artifactId>
      <scope>provided</scope>
    </dependency>

    <dependency>
      <groupId>org.camunda.bpm</groupId>
      <artifactId>camunda-engine-rest-core</artifactId>
    </dependency>

    <!-- Test deps mirrored from assembly -->
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-test</artifactId>
      <version>${version.spring.framework}</version>
      <scope>test</scope>
    </dependency>

    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-web</artifactId>
      <version>${version.spring.framework}</version>
      <scope>test</scope>
    </dependency>

    <dependency>
      <groupId>org.camunda.bpm</groupId>
      <artifactId>camunda-engine-rest-core</artifactId>
      <version>${project.version}</version>
      <scope>test</scope>
      <classifier>tests</classifier>
    </dependency>
  </dependencies>
</project>
```

- [ ] **Step 2: Create `.gitkeep` files**

Plain empty files. Just `touch` each path listed in the Files block above. `.gitkeep` is the project convention for keeping empty dirs in git.

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "feat(webapp-rest): scaffold new Maven module

Empty module ahead of moving Java sources out of webapps/assembly.
Pom mirrors assembly's dependency set (JEE provided + engine-rest-core
compile + spring/engine-rest test) but packages as jar. The assembly
module will be made to depend on this jar in Task 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Move `org.camunda.bpm.webapp.*` (shared infra)

**Scope:** every file under `webapps/assembly/src/main/java/org/camunda/bpm/webapp/` (~50 files: AppRuntimeDelegate, db/, impl/{security,filter,plugin,db,engine,util,test}, plugin/, rest/). These are the shared infrastructure — authentication filters, security filters, app-plugin SPI, query services — used by all four apps.

**Files:**
- Move: `webapps/assembly/src/main/java/org/camunda/bpm/webapp/**/*.java` → `webapps/webapp-rest/src/main/java/org/camunda/bpm/webapp/**/*.java`

- [ ] **Step 1: Run a one-shot script that moves every file with `git mv` (preserves history)**

Run from `/Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform`:

```bash
SRC=webapps/assembly/src/main/java/org/camunda/bpm/webapp
DST=webapps/webapp-rest/src/main/java/org/camunda/bpm/webapp
mkdir -p "$DST"
# Move every leaf file, preserving relative path under the package root.
find "$SRC" -type f -name "*.java" | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
# Remove now-empty source dirs.
find "$SRC" -type d -empty -delete
```

- [ ] **Step 2: Verify nothing was left behind**

Run: `find webapps/assembly/src/main/java/org/camunda/bpm/webapp -type f 2>/dev/null`

Expected: no output (the directory either is empty/missing).

Run: `find webapps/webapp-rest/src/main/java/org/camunda/bpm/webapp -name "*.java" | wc -l`

Expected: ~50 files. Visually scan a few to confirm package declarations + imports are unchanged (they don't change — FQN is identical).

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/ webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move org.camunda.bpm.webapp.*

git mv preserves history. FQNs unchanged; downstream callers still
compile against the same package + class names. Build doesn't compile
yet (other packages still need moving + assembly pom still doesn't
depend on the new module) — that's handled in subsequent tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Move `org.camunda.bpm.cockpit.*`

**Files:**
- Move: `webapps/assembly/src/main/java/org/camunda/bpm/cockpit/**/*.java` → `webapps/webapp-rest/src/main/java/org/camunda/bpm/cockpit/**/*.java`

- [ ] **Step 1: Repeat the move script with cockpit as the source**

```bash
SRC=webapps/assembly/src/main/java/org/camunda/bpm/cockpit
DST=webapps/webapp-rest/src/main/java/org/camunda/bpm/cockpit
mkdir -p "$DST"
find "$SRC" -type f -name "*.java" | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
find "$SRC" -type d -empty -delete
```

- [ ] **Step 2: Verify file count**

Run: `find webapps/webapp-rest/src/main/java/org/camunda/bpm/cockpit -name "*.java" | wc -l`

Expected: ~40 files (Cockpit.java, CockpitRuntimeDelegate, db/, impl/{plugin/{base/dto,base/sub,resources}, web/{bootstrap}}, plugin/{spi,resource,test}, rest/, service/).

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/ webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move org.camunda.bpm.cockpit.*

Includes Cockpit application bootstrap, plugin SPI, base plugin REST
resources (process-instance/definition/incident statistics), and the
shared cockpit DB query service.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Move `org.camunda.bpm.admin.*`

**Files:**
- Move: `webapps/assembly/src/main/java/org/camunda/bpm/admin/**/*.java` → `webapps/webapp-rest/src/main/java/org/camunda/bpm/admin/**/*.java`

- [ ] **Step 1: Repeat the move script for admin**

```bash
SRC=webapps/assembly/src/main/java/org/camunda/bpm/admin
DST=webapps/webapp-rest/src/main/java/org/camunda/bpm/admin
mkdir -p "$DST"
find "$SRC" -type f -name "*.java" | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
find "$SRC" -type d -empty -delete
```

- [ ] **Step 2: Verify file count**

Run: `find webapps/webapp-rest/src/main/java/org/camunda/bpm/admin -name "*.java" | wc -l`

Expected: ~15 files (Admin.java, AdminRuntimeDelegate, AdminApplication, **SetupResource**, AdminPlugins, AdminPluginsRootResource, **MetricsRestService**, plugin/spi/, resource/).

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/ webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move org.camunda.bpm.admin.*

Includes SetupResource (first-run wizard, kept per Q3) and
MetricsRestService (execution metrics, kept). Admin plugin SPI moves
with the rest of the runtime delegate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Move `org.camunda.bpm.tasklist.*`

**Files:**
- Move: `webapps/assembly/src/main/java/org/camunda/bpm/tasklist/**/*.java` → `webapps/webapp-rest/src/main/java/org/camunda/bpm/tasklist/**/*.java`

- [ ] **Step 1: Repeat the move script for tasklist**

```bash
SRC=webapps/assembly/src/main/java/org/camunda/bpm/tasklist
DST=webapps/webapp-rest/src/main/java/org/camunda/bpm/tasklist
mkdir -p "$DST"
find "$SRC" -type f -name "*.java" | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
find "$SRC" -type d -empty -delete
```

- [ ] **Step 2: Verify file count**

Expected: ~10 files (Tasklist.java, TasklistRuntimeDelegate, TasklistApplication, TasklistPlugins, plugin/spi/, resource/).

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/ webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move org.camunda.bpm.tasklist.*

Tasklist application bootstrap + plugin SPI + base plugin REST resources.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Move `org.camunda.bpm.welcome.*`

**Files:**
- Move: `webapps/assembly/src/main/java/org/camunda/bpm/welcome/**/*.java` → `webapps/webapp-rest/src/main/java/org/camunda/bpm/welcome/**/*.java`

- [ ] **Step 1: Repeat the move script for welcome**

```bash
SRC=webapps/assembly/src/main/java/org/camunda/bpm/welcome
DST=webapps/webapp-rest/src/main/java/org/camunda/bpm/welcome
mkdir -p "$DST"
find "$SRC" -type f -name "*.java" | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
find "$SRC" -type d -empty -delete
```

- [ ] **Step 2: Verify the source tree under `org.camunda.bpm` is now empty**

Run: `find webapps/assembly/src/main/java -name "*.java" | head -20`

Expected: empty (or only files under `src/main/runtime/` — those are dev process-application demos, NOT moved; they stay in assembly because they're tied to the deployable war).

If the `runtime/` files are not yet moved, that's expected. They stay in assembly.

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/ webapps/webapp-rest/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move org.camunda.bpm.welcome.*

Welcome runtime delegate + plugin SPI. Completes the move of all four
webapp Java trees. /runtime/ demo process app stays in assembly — it's
tied to the war's deployable artifact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Move resources

**Scope:** every file under `webapps/assembly/src/main/resources/` (not `src/main/webapp/` — those stay). Includes `META-INF/services/` SPI declarations + properties files.

**Files:**
- Move: `webapps/assembly/src/main/resources/**` → `webapps/webapp-rest/src/main/resources/**`

- [ ] **Step 1: Inspect the resources tree first**

Run: `find webapps/assembly/src/main/resources -type f | head -30`

Identify: anything under `META-INF/services/`, properties files, classpath resources. Anything not relevant to the war's classpath should NOT move — but everything in `src/main/resources/` is classpath, so all of it moves.

- [ ] **Step 2: Move everything**

```bash
SRC=webapps/assembly/src/main/resources
DST=webapps/webapp-rest/src/main/resources
mkdir -p "$DST"
find "$SRC" -type f | while read -r f; do
  rel="${f#$SRC/}"
  mkdir -p "$DST/$(dirname "$rel")"
  git mv "$f" "$DST/$rel"
done
find "$SRC" -type d -empty -delete
```

- [ ] **Step 3: Verify resources land in the new module**

Run: `find webapps/webapp-rest/src/main/resources -type f | head -20`

Expected: files mirroring what was under assembly. SPI files under `META-INF/services/` are the load-bearing ones.

- [ ] **Step 4: Commit**

```bash
git add webapps/assembly/src/main/resources/ webapps/webapp-rest/src/main/resources/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move src/main/resources (META-INF/services, etc.)

SPI registration files now live with the Java code that implements them.
src/main/webapp/ (web.xml, static error pages) stays in assembly — those
are war-packaging artifacts, not classpath resources.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Move test sources

**Files:**
- Move: `webapps/assembly/src/test/**` → `webapps/webapp-rest/src/test/**`

- [ ] **Step 1: Move test java + resources**

```bash
for sub in java resources; do
  SRC="webapps/assembly/src/test/$sub"
  DST="webapps/webapp-rest/src/test/$sub"
  if [ -d "$SRC" ]; then
    mkdir -p "$DST"
    find "$SRC" -type f | while read -r f; do
      rel="${f#$SRC/}"
      mkdir -p "$DST/$(dirname "$rel")"
      git mv "$f" "$DST/$rel"
    done
    find "$SRC" -type d -empty -delete
  fi
done
```

- [ ] **Step 2: Verify**

Run: `find webapps/assembly/src/test -type f 2>/dev/null | head` — expect empty.
Run: `find webapps/webapp-rest/src/test -name "*.java" | wc -l` — expect a non-zero count.

- [ ] **Step 3: Commit**

```bash
git add webapps/assembly/src/test/ webapps/webapp-rest/src/test/
git -c commit.gpgsign=false commit -m "refactor(webapp-rest): move src/test to new module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Update parent pom + assembly poms to depend on webapp-rest

**Files:**
- Modify: `webapps/pom.xml`
- Modify: `webapps/assembly/pom.xml`
- Modify: `webapps/assembly-jakarta/pom.xml`

- [ ] **Step 1: Find the existing `<modules>` block in `webapps/pom.xml`**

Run: `grep -n "<modules>" webapps/pom.xml` to locate it.

- [ ] **Step 2: Add `webapp-rest` as the first child module**

Inside the `<modules>` element, add as the FIRST module child:

```xml
    <module>webapp-rest</module>
```

So that Maven builds webapp-rest before assembly (which now depends on it).

- [ ] **Step 3: Add the dependency to `webapps/assembly/pom.xml`**

Locate the `<dependencies>` block and add as the first entry:

```xml
    <dependency>
      <groupId>org.camunda.bpm.webapp</groupId>
      <artifactId>camunda-webapp-rest</artifactId>
      <version>${project.version}</version>
    </dependency>
```

- [ ] **Step 4: Add the dependency to `webapps/assembly-jakarta/pom.xml`**

Same dependency block (locate `<dependencies>`, add first):

```xml
    <dependency>
      <groupId>org.camunda.bpm.webapp</groupId>
      <artifactId>camunda-webapp-rest</artifactId>
      <version>${project.version}</version>
    </dependency>
```

- [ ] **Step 5: Commit**

```bash
git add webapps/pom.xml webapps/assembly/pom.xml webapps/assembly-jakarta/pom.xml
git -c commit.gpgsign=false commit -m "build(webapp-rest): wire new module into reactor + assembly deps

webapp-rest builds first (before assembly, assembly-jakarta). Both
assembly variants now depend on the new jar; their wars contain web.xml
+ static + the webapp-rest jar transitively.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: DevOps handoff — scoped Maven build

This task is **not BE work**. Hand off to DevOps with this exact request:

> **DevOps handoff:** Run a scoped Maven build to verify the webapp-rest split compiles end-to-end.
>
> ```bash
> export JAVA_HOME=$(/usr/libexec/java_home -v 21)
> cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
> ./mvnw -pl webapps/webapp-rest,webapps/assembly,webapps/assembly-jakarta -am clean install
> ```
>
> Expected: BUILD SUCCESS. `webapps/webapp-rest/target/camunda-webapp-rest-7.24.0-SNAPSHOT.jar` exists. `webapps/assembly/target/camunda-webapp.war` exists and contains the webapp-rest jar inside `WEB-INF/lib/`.
>
> Failures to surface:
> - **`package not found` / `cannot resolve symbol`** — a Java file was moved but a referencing class wasn't. Surface the failing class name; BE picks it up to investigate.
> - **`web.xml refers to a class that does not exist`** — the FQN didn't survive the move (shouldn't happen — git mv preserves package declarations).
> - **Test failures** — likely pre-existing. Report; BE decides which are migration-caused vs pre-existing.

- [ ] **Step 1: Wait for DevOps result, then take one of three actions:**

1. **BUILD SUCCESS** — proceed to Task 11.
2. **Compile failure in BE-owned source** — fix the issue inline (one additional commit per fix), re-hand-off.
3. **Pre-existing test failure** — record in `webapp-rest/KNOWN-FAILURES.md` if any; don't fix in this plan.

---

### Task 11: DevOps handoff — Camunda Run distro smoke

> **DevOps handoff:** Build the Camunda Run distro and smoke-test that the webapps still respond.
>
> ```bash
> ./mvnw -pl distro/run/distro -am clean install
> cd distro/run/distro/target/camunda-bpm-run-*-SNAPSHOT
> ./run.sh start --webapps --rest
> ```
>
> Verify each path returns the expected status (200/404 acceptable, 500 fails):
> - `curl -i http://localhost:8080/engine-rest/version` — 200, JSON body
> - `curl -i http://localhost:8080/camunda/api/cockpit/process-definition/statistics` — 200 or 401 (auth), NOT 404
> - `curl -i http://localhost:8080/camunda/api/admin/plugin/adminPlugins` — 200 or 401
> - `curl -i http://localhost:8080/camunda/api/tasklist/process-definition` — 200 or 401
> - `curl -i http://localhost:8080/camunda/api/welcome` — 200 or 401
> - `curl -i http://localhost:8080/camunda/app/cockpit/` — 200 with the legacy AngularJS shell
>
> Stop the distro: `./run.sh stop`. Report results.

- [ ] **Step 1: Wait for DevOps results. If any path returns 500 or a Java exception, the split has a runtime gap — fix inline and re-hand-off.**

---

### Task 12: Final commit consolidation (no-op if previous tasks landed cleanly)

- [ ] **Step 1: Run `git log --oneline -15` and confirm the move history is intact**

Each Task 2–9 should show its own commit. If you used `--amend` anywhere by accident, the history is fine; just confirm the final commits compile + smoke-pass per Tasks 10–11.

- [ ] **Step 2: Tag the milestone**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git tag webapps-next/phase-0a-done
```

No new commit needed.

---

## Self-review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §3.4 Phase 0 split webapps/assembly into webapp-rest (stays) + asset shell (deleted Phase 5) | Tasks 1–9 |
| §6 Custom webapp-REST endpoints survive Phase 5 in the new module | Verified by Task 11 (smoke against running distro) |
| §7 Phase 0 deliverable: webapp-rest new Maven module | Task 1 |
| §7 Phase 0 exit criteria: `mvn -pl webapps/webapp-rest -am clean install` succeeds | Task 10 |
| §7 Phase 0 exit criteria: legacy webapp still serves `/camunda/app/*` with `--ui legacy` | Task 11 |
| R1 (assembly hosts both REST + static) | Whole plan |
| R2 (AuthenticationFilter belongs to assembly) | Moves with `org.camunda.bpm.webapp.*` in Task 2 — filter survives in webapp-rest jar |

**Placeholder scan:** no TBD/TODO. Every move script is concrete. Every verification command has a concrete expected output. DevOps handoff requests are explicit + bounded.

**Type consistency:** N/A for a Java refactor — no new types introduced. All FQNs preserved (git mv keeps `package` declarations exact; imports unchanged).

**One known gap:** `webapps/assembly/src/main/runtime/` (the dev process application demo sources) is NOT moved. That's intentional — it's tied to the war's deployable. Documented in Task 6 step 2.

---

## Execution handoff

Plan complete and saved to `webapps-next/docs/superpowers/plans/2026-05-21-phase0a-assembly-split.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh BE-persona subagent per task, with DevOps handoffs intermixed for Tasks 10–11. Review between tasks; fast iteration.

**2. Inline Execution** — execute mechanical moves in this session via executing-plans, with DevOps handoffs for Tasks 10–11 dispatched by the orchestrator. Batch with checkpoints.

Both modes must respect the CLAUDE.md rule: BE source moves only, no compile/restart. DevOps does Maven builds.
