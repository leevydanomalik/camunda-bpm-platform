# Sample BPMN / DMN deployments

Reference processes for exercising the new webapps-next UI — diagram viewer,
cockpit drill-down, tasklist form-js rendering, etc.

## order-fulfillment.bpmn

Multi-step order process. Exercises:

- Exclusive gateway with a loop-back branch (`Order valid?` → `Request order fix` → back to `Review order`)
- Parallel fork/join (`Pack items` + `Notify carrier` then converge at `Ready to ship`)
- Mixed user tasks (assigned to `sales` / `warehouse` candidate groups) and external-task service tasks
- Default flow + conditional flow on the gateway

### Deploy via engine-rest

The Java engine must be running on `:8080` (Camunda Run distro default).

```bash
cd webapps-next/samples
curl -u demo:demo \
  -F "deployment-name=order-fulfillment-sample" \
  -F "enable-duplicate-filtering=true" \
  -F "data=@order-fulfillment.bpmn;type=text/xml" \
  http://localhost:8080/engine-rest/deployment/create
```

After deploying:

- `/cockpit/processes` lists `order-fulfillment` with running-instance / incident
  counts once instances exist.
- Start an instance:
  ```bash
  curl -u demo:demo -H "Content-Type: application/json" \
    -d '{"variables":{}}' \
    http://localhost:8080/engine-rest/process-definition/key/order-fulfillment/start
  ```
- `/cockpit/deployments` → pick the new deployment → click `order-fulfillment.bpmn`
  to see the diagram rendered by `bpmn-js`.
- `/tasklist` shows the `Review order` user task; selecting it highlights that
  activity in the Diagram tab.
