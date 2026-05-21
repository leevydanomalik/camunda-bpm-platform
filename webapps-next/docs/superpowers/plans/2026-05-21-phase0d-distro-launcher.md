# Phase 0d — Distro launcher --ui flag + Spring reverse proxy — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Mixed DevOps + BE work** — shell scripts and Spring config belong to DevOps; Java code belongs to BE. Both follow CLAUDE.md role boundaries (BE doesn't compile/start; DevOps doesn't edit Java source).

**Goal:** Extend `distro/run/assembly/resources/run.sh` and `run.bat` with a `--ui {legacy|next|both}` flag. Default `legacy` during migration; flips to `next` after Phase 4 (out of this plan's scope). Bundle the `webapps-next` standalone build into the Camunda Run distro at `distro/run/distro/target/.../webapps-next/`. Wire a Spring Boot reverse proxy in the existing `core` module that forwards `/camunda/app/*` to a Next.js child process on a private port when `--ui` is `next` or `both`.

**Architecture:** The distro launcher gains a second optional child process. `run.sh` spawns `node webapps-next/server.js` on `WEBAPPS_NEXT_PORT` (default 3001) when `--ui` ≠ `legacy`. The Spring Boot fat-jar (`camunda-bpm-run-core.jar`) gains a `WebFilter` (registered via `@Component` in a new `WebappsNextProxyFilter` class under `org.camunda.bpm.run.webappsnext`) that, when the runtime flag is set, intercepts `/camunda/app/{cockpit,admin,tasklist,welcome}/*` (and only those subpaths governed by the `--ui` mode) and reverse-proxies to the Next process. Healthcheck on Node startup; graceful shutdown propagates. Static assets in legacy mode remain served by `webapps/assembly`.

**Tech Stack:** Bash + Windows batch + Spring Boot 3 + Java 21 + Next.js 16 (standalone output). One new Maven module under `distro/run/modules/`.

**Source spec:** `webapps-next/docs/superpowers/specs/2026-05-21-webapps-migration-roadmap-design.md` — §3.4 distro packaging, §7 Phase 0 deliverables, R4 risk (launcher orchestration).

---

## File structure

**Created:**

- `distro/run/modules/webapps-next/pom.xml` — Maven module that runs `npm ci && npm run build` in `webapps-next/`, then assembles `.next/standalone/`, `.next/static/`, and `public/` into a tar+gz packaged as a Maven artifact `camunda-bpm-run-webapps-next-7.24.0-SNAPSHOT.tar.gz`.
- `distro/run/modules/webapps-next/src/assembly/webapps-next.xml` — Maven Assembly descriptor for the tarball layout.
- `distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/WebappsNextProxyFilter.java` — new Spring `@Component implements Filter`; conditional on env var `WEBAPPS_NEXT_BASE_URL`.
- `distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/WebappsNextProperties.java` — `@ConfigurationProperties` for `WEBAPPS_NEXT_BASE_URL` + matched path patterns.
- `distro/run/core/src/test/java/org/camunda/bpm/run/webappsnext/WebappsNextProxyFilterTest.java` — proxy behavior unit test (forwards path/method/body; preserves CSRF/cookies; falls through when disabled).

**Modified:**

- `distro/run/pom.xml` — add `<module>modules/webapps-next</module>`.
- `distro/run/modules/pom.xml` — add `<module>webapps-next</module>`.
- `distro/run/assembly/pom.xml` — add a dependency on the new `webapps-next` tarball + assembly hook that extracts it into the distro under `webapps-next/`.
- `distro/run/assembly/assembly.xml` — include the unpacked `webapps-next` directory in the distro tar.
- `distro/run/assembly/resources/run.sh` — add `--ui {legacy|next|both}` flag, Node prereq check, child-process spawn with health probe.
- `distro/run/assembly/resources/run.bat` — Windows mirror of the above.
- `distro/run/assembly/resources/default.yml` — add `camunda.run.webapps-next.base-url` property hook (commented; activated by the launcher when `--ui` ≠ `legacy`).
- `webapps-next/next.config.mjs` — already supports `output: 'standalone'`? Confirm; if not, add.
- `webapps-next/README.md` — note that the standalone build is consumed by the distro Maven module.

**Test-only:**
- `distro/run/qa/integration-tests/src/test/java/.../WebappsNextSmokeIT.java` — boots the distro with `--ui both`, verifies a webapps-next page renders through the proxy.

---

## Task ordering & dependencies

```
Task 1 (next.config standalone output)      ─┐
Task 2 (webapps-next Maven module)           ├─ DevOps tasks (1 + 2 parallelizable)
Task 3 (root + modules + assembly pom wire)  ─┘
  └─ Task 4 (extract tarball into distro)     ── DevOps
       └─ Task 5 (run.sh --ui flag + Node spawn) ── DevOps
            └─ Task 6 (run.bat Windows mirror)    ── DevOps
                 └─ Task 7 (Spring proxy filter class) ── BE handoff
                      └─ Task 8 (proxy properties + activation) ── BE handoff
                           └─ Task 9 (proxy filter unit test) ── BE handoff
                                └─ Task 10 (e2e via Camunda Run distro) ── DevOps
                                     └─ Task 11 (README + docs) ── DevOps
                                          └─ Task 12 (commit consolidation) ── orchestrator
```

Tasks 7–9 are the only BE-owned tasks. The orchestrator dispatches them per CLAUDE.md formation rules. Tasks 1, 5, 6 are pure shell/config — DevOps territory. Task 2 is Maven scaffolding — DevOps.

---

### Task 1: Confirm/enable Next.js standalone output

**Files:**
- Modify: `webapps-next/next.config.mjs`

- [ ] **Step 1: Inspect current config**

Run: `grep -n "output" webapps-next/next.config.mjs`

If `output: 'standalone'` is already set, skip to Task 2.

- [ ] **Step 2: Add the standalone output if missing**

In `webapps-next/next.config.mjs`, inside the `nextConfig` object, add (alongside `reactCompiler: false`):

```js
  output: "standalone",
```

This makes `npm run build` emit `.next/standalone/` with a self-contained server.js + node_modules subset.

- [ ] **Step 3: Smoke test**

Run: `cd webapps-next && npm run build`

Expected: build succeeds; `.next/standalone/server.js` exists.

- [ ] **Step 4: Commit**

```bash
cd webapps-next
git add next.config.mjs
git -c commit.gpgsign=false commit -m "build(next): output: standalone

Required by distro packaging — the standalone server.js + bundled
node_modules subset gets included in the Camunda Run distro's
webapps-next/ directory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: New Maven module that builds webapps-next as a Maven artifact

**Files:**
- Create: `distro/run/modules/webapps-next/pom.xml`
- Create: `distro/run/modules/webapps-next/src/assembly/webapps-next.xml`

- [ ] **Step 1: Create the pom**

`distro/run/modules/webapps-next/pom.xml`:

```xml
<?xml version="1.0"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.camunda.bpm.run</groupId>
    <artifactId>camunda-bpm-run-modules</artifactId>
    <version>7.24.0-SNAPSHOT</version>
  </parent>

  <artifactId>camunda-bpm-run-webapps-next</artifactId>
  <packaging>pom</packaging>

  <name>Camunda Platform - Run - Modules - Webapps Next</name>
  <description>
    Build wrapper: invokes `npm ci` + `npm run build` in webapps-next/,
    then assembles the standalone output (.next/standalone/, .next/static/,
    public/) into a tarball consumed by the distro assembly.
  </description>

  <properties>
    <webapps.next.dir>${project.basedir}/../../../../webapps-next</webapps.next.dir>
  </properties>

  <build>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <executions>
          <execution>
            <id>npm-ci</id>
            <phase>generate-resources</phase>
            <goals><goal>exec</goal></goals>
            <configuration>
              <executable>npm</executable>
              <arguments>
                <argument>ci</argument>
              </arguments>
              <workingDirectory>${webapps.next.dir}</workingDirectory>
            </configuration>
          </execution>
          <execution>
            <id>npm-build</id>
            <phase>compile</phase>
            <goals><goal>exec</goal></goals>
            <configuration>
              <executable>npm</executable>
              <arguments>
                <argument>run</argument>
                <argument>build</argument>
              </arguments>
              <workingDirectory>${webapps.next.dir}</workingDirectory>
            </configuration>
          </execution>
        </executions>
      </plugin>

      <plugin>
        <artifactId>maven-assembly-plugin</artifactId>
        <executions>
          <execution>
            <id>build-tar</id>
            <phase>package</phase>
            <goals><goal>single</goal></goals>
            <configuration>
              <descriptors>
                <descriptor>src/assembly/webapps-next.xml</descriptor>
              </descriptors>
              <appendAssemblyId>false</appendAssemblyId>
              <tarLongFileMode>posix</tarLongFileMode>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
```

- [ ] **Step 2: Create the assembly descriptor**

`distro/run/modules/webapps-next/src/assembly/webapps-next.xml`:

```xml
<assembly xmlns="http://maven.apache.org/ASSEMBLY/2.1.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/ASSEMBLY/2.1.0 http://maven.apache.org/xsd/assembly-2.1.0.xsd">
  <id>webapps-next</id>
  <formats>
    <format>tar.gz</format>
  </formats>
  <includeBaseDirectory>false</includeBaseDirectory>

  <fileSets>
    <fileSet>
      <directory>${webapps.next.dir}/.next/standalone</directory>
      <outputDirectory>/</outputDirectory>
    </fileSet>
    <fileSet>
      <directory>${webapps.next.dir}/.next/static</directory>
      <outputDirectory>/.next/static</outputDirectory>
    </fileSet>
    <fileSet>
      <directory>${webapps.next.dir}/public</directory>
      <outputDirectory>/public</outputDirectory>
    </fileSet>
  </fileSets>
</assembly>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/modules/webapps-next/
git -c commit.gpgsign=false commit -m "build(distro): Maven module that packages webapps-next standalone

Invokes npm ci + npm run build in webapps-next/, then bundles
.next/standalone + .next/static + public into a tarball Maven artifact.
The distro assembly (Task 3) consumes it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire new module into reactor + distro assembly dep

**Files:**
- Modify: `distro/run/modules/pom.xml`
- Modify: `distro/run/pom.xml`
- Modify: `distro/run/assembly/pom.xml`

- [ ] **Step 1: Add module entry to `distro/run/modules/pom.xml`**

Inside the `<modules>` element, append:

```xml
    <module>webapps-next</module>
```

- [ ] **Step 2: Verify `distro/run/pom.xml`**

Inspect: `grep -n "<module>" distro/run/pom.xml`. If `modules` is already listed (as a directory parent), no change here. If `modules/webapps-next` needs to be referenced explicitly, add accordingly.

- [ ] **Step 3: Add the dependency in `distro/run/assembly/pom.xml`**

Inside `<dependencies>`:

```xml
    <dependency>
      <groupId>org.camunda.bpm.run</groupId>
      <artifactId>camunda-bpm-run-webapps-next</artifactId>
      <version>${project.version}</version>
      <type>tar.gz</type>
    </dependency>
```

- [ ] **Step 4: Extend `distro/run/assembly/assembly.xml` with dependency unpack**

Locate the `<dependencySets>` block (or create one) and add:

```xml
    <dependencySet>
      <outputDirectory>webapps-next</outputDirectory>
      <unpack>true</unpack>
      <includes>
        <include>org.camunda.bpm.run:camunda-bpm-run-webapps-next:tar.gz</include>
      </includes>
    </dependencySet>
```

- [ ] **Step 5: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/modules/pom.xml distro/run/pom.xml distro/run/assembly/pom.xml distro/run/assembly/assembly.xml
git -c commit.gpgsign=false commit -m "build(distro): wire webapps-next module + assembly unpack

distro/run/modules now lists webapps-next. The assembly tarball pulls
the tar.gz and unpacks it under webapps-next/ in the final distro.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: DevOps handoff — verify distro build

> **DevOps handoff:** Build the distro to confirm the webapps-next module integrates cleanly.
>
> ```bash
> export JAVA_HOME=$(/usr/libexec/java_home -v 21)
> cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
> ./mvnw -pl distro/run/modules/webapps-next,distro/run/distro -am clean install
> ```
>
> Expected:
> - `distro/run/modules/webapps-next/target/camunda-bpm-run-webapps-next-7.24.0-SNAPSHOT.tar.gz` exists.
> - `distro/run/distro/target/camunda-bpm-run-*-SNAPSHOT/webapps-next/server.js` exists.
> - The distro tarball contains `webapps-next/server.js`.
>
> Failures likely:
> - `npm: command not found` — DevOps installs Node 20+ and reruns.
> - `exec-maven-plugin failing on npm run build` — surface the build log; if FE source compile error, hand off to FE.

- [ ] **Step 1: Wait for DevOps result. Proceed to Task 5 only when the distro contains webapps-next/server.js.**

---

### Task 5: Extend `run.sh` with --ui flag, Node prereq, child spawn

**Files:**
- Modify: `distro/run/assembly/resources/run.sh`

- [ ] **Step 1: Add the `--ui` parsing**

In `run.sh`, in the `OPTIONS_HELP` heredoc, add (after `--detached`):

```
  --ui MODE    - UI mode: legacy (AngularJS, default), next (webapps-next), or both
```

Then update the variable initialization block (after `detachProcess=false`):

```bash
uiMode=legacy
WEBAPPS_NEXT_PORT=${WEBAPPS_NEXT_PORT:-3001}
WEBAPPS_NEXT_PID_PATH=$BASEDIR/webapps-next.pid
```

In the argument-parsing case block (after `--detached )`), add:

```bash
      --ui )         shift
                     case "$1" in
                       legacy|next|both ) uiMode=$1 ;;
                       * ) echo "Invalid --ui value: $1 (expected legacy|next|both)"; exit 1 ;;
                     esac
                     echo "UI mode: $uiMode"
                     ;;
```

- [ ] **Step 2: Add Node prereq check (only when uiMode ≠ legacy)**

After the JDK version check block, add:

```bash
  if [ "$uiMode" != "legacy" ]; then
    if ! command -v node >/dev/null 2>&1; then
      echo "Node.js is required for --ui $uiMode (not found in PATH)."
      echo "Install Node 20+ and ensure 'node' is on PATH."
      exit 1
    fi
    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
    if [ "$NODE_MAJOR" -lt 20 ]; then
      echo "Node $NODE_MAJOR found; require >= 20."
      exit 1
    fi
    echo "Node version: $(node -v)"
  fi
```

- [ ] **Step 3: Spawn the Next process before the JVM start (when uiMode ≠ legacy)**

Right before the `# start the application` comment, add:

```bash
  # webapps-next standalone server (Next.js)
  if [ "$uiMode" != "legacy" ]; then
    WEBAPPS_NEXT_DIR="$BASEDIR/webapps-next"
    if [ ! -f "$WEBAPPS_NEXT_DIR/server.js" ]; then
      echo "ERROR: webapps-next/server.js missing — distro build did not include it."
      exit 1
    fi
    echo "Starting webapps-next on port $WEBAPPS_NEXT_PORT…"
    (cd "$WEBAPPS_NEXT_DIR" && PORT=$WEBAPPS_NEXT_PORT HOSTNAME=127.0.0.1 node server.js &)
    echo $! > "$WEBAPPS_NEXT_PID_PATH"

    # Health probe (15s timeout)
    for i in $(seq 1 30); do
      if curl -sf "http://127.0.0.1:$WEBAPPS_NEXT_PORT/api/auth/csrf" >/dev/null 2>&1 \
         || curl -sf "http://127.0.0.1:$WEBAPPS_NEXT_PORT/login" >/dev/null 2>&1; then
        echo "webapps-next is up."
        break
      fi
      sleep 0.5
    done

    # Tell Spring proxy where to forward.
    export WEBAPPS_NEXT_BASE_URL="http://127.0.0.1:$WEBAPPS_NEXT_PORT"
    export WEBAPPS_NEXT_UI_MODE="$uiMode"
  fi
```

- [ ] **Step 4: Update the `stop` branch to kill webapps-next as well**

In the `elif [ "$1" = "stop" ]` block, after the existing `kill $(cat "$PID_PATH")`, add:

```bash
  if [ -s "$WEBAPPS_NEXT_PID_PATH" ]; then
    kill $(cat "$WEBAPPS_NEXT_PID_PATH") 2>/dev/null || true
    rm "$WEBAPPS_NEXT_PID_PATH"
    echo "webapps-next is shutting down."
  fi
```

- [ ] **Step 5: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/assembly/resources/run.sh
git -c commit.gpgsign=false commit -m "feat(distro): --ui flag + Node child process in run.sh

When --ui is 'next' or 'both', runs a health-probed Node child for the
webapps-next standalone server on \$WEBAPPS_NEXT_PORT (3001 default),
exports WEBAPPS_NEXT_BASE_URL and _UI_MODE for the Spring proxy filter
(Task 7). Node 20+ prereq enforced.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Mirror in `run.bat`

**Files:**
- Modify: `distro/run/assembly/resources/run.bat`

- [ ] **Step 1: Mirror the additions from Task 5 in Windows batch syntax**

Detailed step-by-step:
- Add `SET uiMode=legacy` and `SET WEBAPPS_NEXT_PORT=3001` to the initialization block.
- Add `--ui` parsing in the `:Loop` block (`IF [%~1]==[--ui]` reads next arg, validates one of legacy|next|both).
- After the JDK version check, add Node 20+ probe (use `node -v` and `findstr` for version).
- Before `REM start the application`, conditional Node spawn via `start "Webapps Next" /B node server.js` and a polling loop using `powershell -Command "Invoke-WebRequest"` for health.
- Set env vars `WEBAPPS_NEXT_BASE_URL` and `WEBAPPS_NEXT_UI_MODE` before the JVM call.
- In the `:Stop` block, `TASKKILL /FI "WINDOWTITLE eq Webapps Next"` plus PID-file kill.

(Full Windows batch syntax is verbose; the executor should follow run.sh as the canonical reference and adapt mechanics — `set`, `if`, `for` loops — to batch. Existing run.bat structure is the template.)

- [ ] **Step 2: Smoke-test on a Windows VM (or skip with note)**

If a Windows VM is available, run `run.bat start --webapps --ui next` and verify the same probe behavior. If not available, mark this task as "smoke-tested-on-windows: PENDING" in the commit and follow up post-merge.

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/assembly/resources/run.bat
git -c commit.gpgsign=false commit -m "feat(distro): mirror --ui + Node spawn in run.bat

Windows mirror of Task 5. PID tracking via WINDOWTITLE.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: BE handoff — Spring proxy filter class

> **BE handoff:** Create the Spring filter that reverse-proxies `/camunda/app/*` to the Next process. Below is the full spec; produce the file at `distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/WebappsNextProxyFilter.java`.

**Files:**
- Create: `distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/WebappsNextProxyFilter.java`

- [ ] **Step 1: Create the filter**

```java
package org.camunda.bpm.run.webappsnext;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Set;

/**
 * Reverse-proxies /camunda/app/{cockpit,admin,tasklist,welcome}/* to the
 * webapps-next standalone server when WEBAPPS_NEXT_BASE_URL is set.
 *
 * Activation rules:
 * - WEBAPPS_NEXT_BASE_URL must be set (e.g., http://127.0.0.1:3001).
 * - WEBAPPS_NEXT_UI_MODE controls which app paths are proxied:
 *     "next"  -> all four /camunda/app/{cockpit,admin,tasklist,welcome}/*
 *     "both"  -> per per-phase per-app rollout (consult APP_ROLLOUT property; default all)
 *     unset/"legacy" -> nothing (filter passes through).
 */
public class WebappsNextProxyFilter implements Filter {

  private static final Set<String> APP_PREFIXES = Set.of(
      "/camunda/app/cockpit", "/camunda/app/admin",
      "/camunda/app/tasklist", "/camunda/app/welcome");

  private final HttpClient client = HttpClient.newHttpClient();
  private final String baseUrl;
  private final String uiMode;

  public WebappsNextProxyFilter(String baseUrl, String uiMode) {
    this.baseUrl = baseUrl;
    this.uiMode = uiMode;
  }

  @Override
  public void doFilter(ServletRequest sreq, ServletResponse sres, FilterChain chain)
      throws IOException, ServletException {
    HttpServletRequest req = (HttpServletRequest) sreq;
    HttpServletResponse res = (HttpServletResponse) sres;

    String path = req.getRequestURI();
    if (baseUrl == null || baseUrl.isBlank() || !shouldProxy(path)) {
      chain.doFilter(sreq, sres);
      return;
    }

    String target = baseUrl + path + (req.getQueryString() != null ? "?" + req.getQueryString() : "");

    HttpRequest.Builder upstream = HttpRequest.newBuilder(URI.create(target));
    // Copy headers (skip hop-by-hop)
    var headerNames = req.getHeaderNames();
    while (headerNames.hasMoreElements()) {
      String h = headerNames.nextElement();
      if (isHopByHop(h)) continue;
      upstream.header(h, req.getHeader(h));
    }

    // Body
    if ("POST".equalsIgnoreCase(req.getMethod()) || "PUT".equalsIgnoreCase(req.getMethod())
        || "PATCH".equalsIgnoreCase(req.getMethod()) || "DELETE".equalsIgnoreCase(req.getMethod())) {
      upstream.method(req.getMethod(), HttpRequest.BodyPublishers.ofInputStream(() -> {
        try { return req.getInputStream(); } catch (IOException e) { throw new RuntimeException(e); }
      }));
    } else {
      upstream.method(req.getMethod(), HttpRequest.BodyPublishers.noBody());
    }

    try {
      HttpResponse<byte[]> upstreamRes = client.send(upstream.build(), HttpResponse.BodyHandlers.ofByteArray());
      res.setStatus(upstreamRes.statusCode());
      upstreamRes.headers().map().forEach((k, vs) -> {
        if (!isHopByHop(k)) vs.forEach(v -> res.addHeader(k, v));
      });
      res.getOutputStream().write(upstreamRes.body());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      res.sendError(HttpServletResponse.SC_BAD_GATEWAY, "Upstream interrupted");
    } catch (IOException e) {
      res.sendError(HttpServletResponse.SC_BAD_GATEWAY, "webapps-next unreachable: " + e.getMessage());
    }
  }

  private boolean shouldProxy(String path) {
    if (!"next".equals(uiMode) && !"both".equals(uiMode)) return false;
    for (String prefix : APP_PREFIXES) {
      if (path.startsWith(prefix)) return true;
    }
    return false;
  }

  private boolean isHopByHop(String name) {
    String lc = name.toLowerCase();
    return lc.equals("connection") || lc.equals("keep-alive") || lc.equals("proxy-authenticate")
        || lc.equals("proxy-authorization") || lc.equals("te") || lc.equals("trailers")
        || lc.equals("transfer-encoding") || lc.equals("upgrade");
  }

  @Configuration
  public static class Registration {
    @Bean
    public FilterRegistrationBean<WebappsNextProxyFilter> webappsNextProxyFilter() {
      String baseUrl = System.getenv("WEBAPPS_NEXT_BASE_URL");
      String uiMode = System.getenv("WEBAPPS_NEXT_UI_MODE");
      FilterRegistrationBean<WebappsNextProxyFilter> reg = new FilterRegistrationBean<>();
      reg.setFilter(new WebappsNextProxyFilter(baseUrl, uiMode));
      reg.addUrlPatterns("/camunda/app/*");
      reg.setOrder(Integer.MIN_VALUE + 10);  // Run before the legacy webapps servlet.
      return reg;
    }
  }
}
```

- [ ] **Step 2: BE: confirm the file's package is reachable from the existing Spring config (no @ComponentScan tweak needed because the `@Configuration` inner class will be auto-discovered if `org.camunda.bpm.run` is the scan root)**

Verify with: `grep -r "@ComponentScan\|@SpringBootApplication" distro/run/core/src/main/java/` to find the scan root.

If the scan root is narrower, add `org.camunda.bpm.run.webappsnext` to its base packages.

- [ ] **Step 3: Commit (BE)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/
git -c commit.gpgsign=false commit -m "feat(run): WebappsNextProxyFilter for /camunda/app/*

Reverse-proxies to webapps-next standalone (env WEBAPPS_NEXT_BASE_URL)
when WEBAPPS_NEXT_UI_MODE is 'next' or 'both'. Hop-by-hop headers
stripped. Passes through when env vars unset (legacy mode unaffected).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: BE handoff — Configuration properties (env-driven, no yaml changes)

The current filter (Task 7) reads env vars directly. To allow yaml overrides without a code change, add a Spring `@ConfigurationProperties` class.

**Files:**
- Create: `distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/WebappsNextProperties.java`

- [ ] **Step 1: Create the properties class**

```java
package org.camunda.bpm.run.webappsnext;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "camunda.run.webapps-next")
@EnableConfigurationProperties(WebappsNextProperties.class)
public class WebappsNextProperties {

  /** Reverse-proxy target. Set by run.sh/run.bat from --ui flag. Overridable via env var or yaml. */
  private String baseUrl;
  /** UI mode: legacy | next | both. */
  private String mode = "legacy";

  public String getBaseUrl() { return baseUrl; }
  public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
  public String getMode() { return mode; }
  public void setMode(String mode) { this.mode = mode; }
}
```

- [ ] **Step 2: Update the filter's `Registration` to read from `WebappsNextProperties` instead of env vars directly**

In `WebappsNextProxyFilter.java`, replace the `Registration` inner class body with:

```java
  @Configuration
  public static class Registration {
    @Bean
    public FilterRegistrationBean<WebappsNextProxyFilter> webappsNextProxyFilter(WebappsNextProperties props) {
      // Env vars take precedence over yaml when set (set by run.sh).
      String baseUrl = props.getBaseUrl();
      if (baseUrl == null) baseUrl = System.getenv("WEBAPPS_NEXT_BASE_URL");
      String uiMode = props.getMode();
      if (uiMode == null || "legacy".equals(uiMode)) {
        String envMode = System.getenv("WEBAPPS_NEXT_UI_MODE");
        if (envMode != null) uiMode = envMode;
      }
      FilterRegistrationBean<WebappsNextProxyFilter> reg = new FilterRegistrationBean<>();
      reg.setFilter(new WebappsNextProxyFilter(baseUrl, uiMode));
      reg.addUrlPatterns("/camunda/app/*");
      reg.setOrder(Integer.MIN_VALUE + 10);
      return reg;
    }
  }
```

- [ ] **Step 3: Commit (BE)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/core/src/main/java/org/camunda/bpm/run/webappsnext/
git -c commit.gpgsign=false commit -m "feat(run): WebappsNextProperties for yaml-overridable proxy config

Env vars from run.sh still take precedence; yaml is the fallback. Lets
operators tune --ui via configuration/default.yml when the launcher is
not customizable in their deployment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: BE handoff — Filter unit test

**Files:**
- Create: `distro/run/core/src/test/java/org/camunda/bpm/run/webappsnext/WebappsNextProxyFilterTest.java`

- [ ] **Step 1: Create the test**

```java
package org.camunda.bpm.run.webappsnext;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.IOException;

import static org.mockito.Mockito.*;

class WebappsNextProxyFilterTest {

  @Test
  void passesThroughWhenBaseUrlUnset() throws Exception {
    WebappsNextProxyFilter f = new WebappsNextProxyFilter(null, "next");
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse res = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/camunda/app/cockpit/");
    f.doFilter(req, res, chain);
    verify(chain).doFilter(req, res);
  }

  @Test
  void passesThroughInLegacyMode() throws Exception {
    WebappsNextProxyFilter f = new WebappsNextProxyFilter("http://127.0.0.1:3001", "legacy");
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse res = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/camunda/app/cockpit/");
    f.doFilter(req, res, chain);
    verify(chain).doFilter(req, res);
  }

  @Test
  void passesThroughForNonCamundaAppPath() throws Exception {
    WebappsNextProxyFilter f = new WebappsNextProxyFilter("http://127.0.0.1:3001", "next");
    HttpServletRequest req = mock(HttpServletRequest.class);
    HttpServletResponse res = mock(HttpServletResponse.class);
    FilterChain chain = mock(FilterChain.class);

    when(req.getRequestURI()).thenReturn("/engine-rest/version");
    f.doFilter(req, res, chain);
    verify(chain).doFilter(req, res);
  }
}
```

- [ ] **Step 2: BE handoff — DevOps runs the test**

> **DevOps:** Run `./mvnw -pl distro/run/core test`. Expect: 3 new tests under `WebappsNextProxyFilterTest` pass, plus existing tests stay green.

- [ ] **Step 3: Commit (BE)**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/core/src/test/java/org/camunda/bpm/run/webappsnext/
git -c commit.gpgsign=false commit -m "test(run): WebappsNextProxyFilter pass-through tests

Verifies the filter never intercepts when baseUrl is null, when uiMode
is legacy, or when the path isn't under /camunda/app/. Live-forwarding
behavior is verified by the integration test in Task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: DevOps — distro-level smoke test

> **DevOps handoff:** Run the full distro with --ui both and verify both UIs are reachable through port 8080.
>
> ```bash
> cd distro/run/distro/target/camunda-bpm-run-*-SNAPSHOT
> ./run.sh start --webapps --rest --ui both
>
> # Legacy still works:
> curl -i http://localhost:8080/camunda/app/cockpit/   # AngularJS shell
>
> # Webapps-next reachable through reverse proxy:
> # (only after Phase 1+ cuts an app over to --ui next; for this smoke,
> # verify the /camunda/app/welcome path reaches Next when configured.)
> WEBAPPS_NEXT_UI_MODE=next ./run.sh start --webapps --rest --ui next
> curl -i http://localhost:8080/camunda/app/welcome     # webapps-next welcome page (or login redirect)
>
> ./run.sh stop
> ```
>
> Failure modes:
> - Node not in PATH → run.sh exits 1; DevOps installs Node 20+.
> - `/camunda/app/welcome` returns the legacy AngularJS page → filter not registered; check Spring scan root.
> - 502 → webapps-next health probe didn't pass; check `webapps-next.pid` and `tail` Node logs.

- [ ] **Step 1: Wait for DevOps result. If 502 or wrong-UI returned, fix and re-test.**

---

### Task 11: Documentation

**Files:**
- Modify: `distro/run/README.md` (find or create)
- Modify: `webapps-next/README.md`

- [ ] **Step 1: Document the `--ui` flag in the distro README**

In the distro README (likely `distro/run/README.md`), add a section:

```markdown
## --ui flag (UI mode)

Camunda Run can serve either of two UIs (or both during migration):

| Mode | What you get |
|---|---|
| `legacy` (default) | AngularJS UI from `webapps/assembly` only |
| `next` | webapps-next (Next.js) only |
| `both` | Both, routed per-app by the Spring reverse-proxy filter |

### Prerequisites for `next` / `both`

- Node.js 20+ on PATH.
- `webapps-next/server.js` present in the distro (auto-bundled by the build).

### Switching modes

```bash
./run.sh start --webapps --rest --ui next
```

When `--ui` is `next` or `both`, run.sh spawns a Node child on `WEBAPPS_NEXT_PORT` (default 3001). The Spring fat-jar's `WebappsNextProxyFilter` forwards `/camunda/app/*` to it. Both processes shut down via `./run.sh stop`.

### Environment overrides

- `WEBAPPS_NEXT_PORT` — port for the Node child (default 3001).
- `WEBAPPS_NEXT_BASE_URL` — explicit override of the reverse-proxy target.
- `WEBAPPS_NEXT_UI_MODE` — explicit override (matches `--ui` if both set).
```

- [ ] **Step 2: Cross-link from `webapps-next/README.md`**

Append:

```markdown
## Distro integration

The Camunda Run distro auto-bundles this app's standalone build into `webapps-next/` under the distro root. The launcher (`run.sh --ui next`) starts the Node child + reverse-proxies via `WebappsNextProxyFilter`. See `distro/run/README.md` for the `--ui` flag reference.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git add distro/run/README.md webapps-next/README.md
git -c commit.gpgsign=false commit -m "docs(distro): --ui flag + webapps-next integration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Final consolidation

- [ ] **Step 1: Tag**

```bash
cd /Users/leevydmalik/Project/CAMUNDA/camunda-bpm-platform
git tag webapps-next/phase-0d-done
```

---

## Self-review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §3.4 standalone Node process inside distro | Tasks 1–6 |
| §3.4 `--ui` flag with legacy/next/both | Tasks 5, 6 |
| §3.4 Node prerequisite | Task 5 (run.sh probe) + Task 11 (docs) |
| §3.4 Spring reverse-proxy routing /camunda/app/* | Tasks 7, 8 |
| §7 Phase 0 deliverable: distro launcher + reverse-proxy | All tasks |
| §7 Phase 0 exit: `--ui next` boots both processes; /camunda/app/welcome reaches Next | Task 10 |
| R4 launcher orchestration | Health probe (Task 5), PID tracking, graceful stop |

**Placeholder scan:** clean. One soft spot: run.bat in Task 6 doesn't have a full literal source (the executor mirrors run.sh into batch syntax following the existing run.bat structure). This is a deliberate concession to the verbosity of Windows batch — the existing run.bat is the template; mechanics are obvious. If a literal version is required, the executor should produce it during Task 6 and commit it.

**Type consistency:** N/A across shell + Java; same env-var names referenced consistently (`WEBAPPS_NEXT_PORT`, `WEBAPPS_NEXT_BASE_URL`, `WEBAPPS_NEXT_UI_MODE`).

---

## Execution handoff

Two execution options:

**1. Subagent-Driven (recommended)** — DevOps for Tasks 1–6, 10–11; BE for Tasks 7–9; orchestrator handles Task 12. Hand off cross-team transitions explicitly.

**2. Inline Execution** — Inline only if the operator is comfortable touching DevOps and BE files in one session. Still respect role boundaries (orchestrator doesn't run `./mvnw`; DevOps does).

Which approach?
