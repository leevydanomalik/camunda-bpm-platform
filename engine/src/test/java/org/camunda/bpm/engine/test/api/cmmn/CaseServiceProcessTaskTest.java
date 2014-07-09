/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.camunda.bpm.engine.test.api.cmmn;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.camunda.bpm.engine.ProcessEngineException;
import org.camunda.bpm.engine.impl.test.PluggableProcessEngineTestCase;
import org.camunda.bpm.engine.runtime.CaseExecution;
import org.camunda.bpm.engine.runtime.CaseInstance;
import org.camunda.bpm.engine.runtime.ProcessInstance;
import org.camunda.bpm.engine.runtime.VariableInstance;
import org.camunda.bpm.engine.task.Task;
import org.camunda.bpm.engine.test.Deployment;

/**
 * @author Roman Smirnov
 *
 */
public class CaseServiceProcessTaskTest extends PluggableProcessEngineTestCase {

  protected final String DEFINITION_KEY = "oneProcessTaskCase";
  protected final String PROCESS_TASK_KEY = "PI_ProcessTask_1";

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStart() {
    // given
    String caseInstanceId = createCaseInstance(DEFINITION_KEY).getId();
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // when
    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    // then
    processInstance = queryProcessInstance();

    assertNotNull(processInstance);
    assertEquals(caseInstanceId, processInstance.getCaseInstanceId());

    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isActive());
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStartWithVariable() {
    // given
    String caseInstanceId = createCaseInstance(DEFINITION_KEY).getId();
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // when
    caseService
      .withCaseExecution(processTaskId)
      .setVariable("aVariableName", "abc")
      .setVariable("anotherVariableName", 999)
      .manualStart();

    // then
    processInstance = queryProcessInstance();

    assertNotNull(processInstance);
    assertEquals(caseInstanceId, processInstance.getCaseInstanceId());

    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isActive());

    // the case instance has two variables:
    // - aVariableName
    // - anotherVariableName
    List<VariableInstance> result = runtimeService
        .createVariableInstanceQuery()
        .list();

    assertFalse(result.isEmpty());
    assertEquals(2, result.size());

    for (VariableInstance variable : result) {

      assertEquals(caseInstanceId, variable.getCaseExecutionId());
      assertEquals(caseInstanceId, variable.getCaseInstanceId());

      if (variable.getName().equals("aVariableName")) {
        assertEquals("aVariableName", variable.getName());
        assertEquals("abc", variable.getValue());
      } else if (variable.getName().equals("anotherVariableName")) {
        assertEquals("anotherVariableName", variable.getName());
        assertEquals(999, variable.getValue());
      } else {
        fail("Unexpected variable: " + variable.getName());
      }
    }

  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStartWithVariables() {
    // given
    String caseInstanceId = createCaseInstance(DEFINITION_KEY).getId();
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // variables
    Map<String, Object> variables = new HashMap<String, Object>();
    variables.put("aVariableName", "abc");
    variables.put("anotherVariableName", 999);

    // when
    caseService
      .withCaseExecution(processTaskId)
      .setVariables(variables)
      .manualStart();

    // then
    processInstance = queryProcessInstance();

    assertNotNull(processInstance);
    assertEquals(caseInstanceId, processInstance.getCaseInstanceId());

    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isActive());

    // the case instance has two variables:
    // - aVariableName
    // - anotherVariableName
    List<VariableInstance> result = runtimeService
        .createVariableInstanceQuery()
        .list();

    assertFalse(result.isEmpty());
    assertEquals(2, result.size());

    for (VariableInstance variable : result) {

      assertEquals(caseInstanceId, variable.getCaseExecutionId());
      assertEquals(caseInstanceId, variable.getCaseInstanceId());

      if (variable.getName().equals("aVariableName")) {
        assertEquals("aVariableName", variable.getName());
        assertEquals("abc", variable.getValue());
      } else if (variable.getName().equals("anotherVariableName")) {
        assertEquals("anotherVariableName", variable.getName());
        assertEquals(999, variable.getValue());
      } else {
        fail("Unexpected variable: " + variable.getName());
      }
    }

  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStartWithLocalVariable() {
    // given
    String caseInstanceId = createCaseInstance(DEFINITION_KEY).getId();
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // when
    caseService
      .withCaseExecution(processTaskId)
      .setVariableLocal("aVariableName", "abc")
      .setVariableLocal("anotherVariableName", 999)
      .manualStart();

    // then
    processInstance = queryProcessInstance();

    assertNotNull(processInstance);
    assertEquals(caseInstanceId, processInstance.getCaseInstanceId());

    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isActive());

    // the case instance has two variables:
    // - aVariableName
    // - anotherVariableName
    List<VariableInstance> result = runtimeService
        .createVariableInstanceQuery()
        .list();

    assertFalse(result.isEmpty());
    assertEquals(2, result.size());

    for (VariableInstance variable : result) {

      assertEquals(processTaskId, variable.getCaseExecutionId());
      assertEquals(caseInstanceId, variable.getCaseInstanceId());

      if (variable.getName().equals("aVariableName")) {
        assertEquals("aVariableName", variable.getName());
        assertEquals("abc", variable.getValue());
      } else if (variable.getName().equals("anotherVariableName")) {
        assertEquals("anotherVariableName", variable.getName());
        assertEquals(999, variable.getValue());
      } else {
        fail("Unexpected variable: " + variable.getName());
      }
    }

  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStartWithLocalVariables() {
    // given
    String caseInstanceId = createCaseInstance(DEFINITION_KEY).getId();
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // variables
    Map<String, Object> variables = new HashMap<String, Object>();
    variables.put("aVariableName", "abc");
    variables.put("anotherVariableName", 999);

    // when
    // activate child case execution
    caseService
      .withCaseExecution(processTaskId)
      .setVariablesLocal(variables)
      .manualStart();

    // then
    processInstance = queryProcessInstance();

    assertNotNull(processInstance);
    assertEquals(caseInstanceId, processInstance.getCaseInstanceId());

    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isActive());

    // the case instance has two variables:
    // - aVariableName
    // - anotherVariableName
    List<VariableInstance> result = runtimeService
        .createVariableInstanceQuery()
        .list();

    assertFalse(result.isEmpty());
    assertEquals(2, result.size());

    for (VariableInstance variable : result) {

      assertEquals(processTaskId, variable.getCaseExecutionId());
      assertEquals(caseInstanceId, variable.getCaseInstanceId());

      if (variable.getName().equals("aVariableName")) {
        assertEquals("aVariableName", variable.getName());
        assertEquals("abc", variable.getValue());
      } else if (variable.getName().equals("anotherVariableName")) {
        assertEquals("anotherVariableName", variable.getName());
        assertEquals(999, variable.getValue());
      } else {
        fail("Unexpected variable: " + variable.getName());
      }
    }

  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn"
      })
  public void testReenableAnEnabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .reenable();
      fail("It should not be possible to re-enable an enabled process task.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskAndOneHumanTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testReenableADisabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    caseService
      .withCaseExecution(processTaskId)
      .disable();

    // when
    caseService
      .withCaseExecution(processTaskId)
      .reenable();

    // then
    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isEnabled());
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testReenableAnActiveProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .reenable();
      fail("It should not be possible to re-enable an active process task.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskAndOneHumanTaskCase.cmmn"})
  public void testDisableAnEnabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    ProcessInstance processInstance = queryProcessInstance();
    assertNull(processInstance);

    // when
    caseService
      .withCaseExecution(processTaskId)
      .disable();

    // then
    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertTrue(processTask.isDisabled());
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskAndOneHumanTaskCase.cmmn"})
  public void testDisableADisabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .disable();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .disable();
      fail("It should not be possible to disable a already disabled process task.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testDisableAnActiveProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    // when
    try {
      caseService
        .withCaseExecution(processTaskId)
        .disable();
      fail("It should not be possible to disable an active process task.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskAndOneHumanTaskCase.cmmn"})
  public void testManualStartOfADisabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .disable();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .manualStart();
      fail("It should not be possible to start a disabled process task manually.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testManualStartOfAnActiveProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .manualStart();
      fail("It should not be possible to start an already active process task manually.");
    } catch (Exception e) {
    }
  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testComplete() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .complete();
      fail("It should not be possible to complete a process task, while the process instance is still running.");
    } catch (Exception e) {}

  }

  @Deployment(resources={
      "org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn",
      "org/camunda/bpm/engine/test/api/oneTaskProcess.bpmn20.xml"
      })
  public void testCompleteProcessInstanceShouldCompleteProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .manualStart();

    String taskId = queryTask().getId();

    // when
    taskService.complete(taskId);

    // then
    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertNull(processTask);

    CaseInstance caseInstance = caseService
        .createCaseInstanceQuery()
        .singleResult();

    assertNotNull(caseInstance);
    assertTrue(caseInstance.isCompleted());

  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn"})
  public void testDisableShouldCompleteCaseInstance() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    // when

    caseService
      .withCaseExecution(processTaskId)
      .disable();

    // then
    CaseExecution processTask = queryCaseExecutionByActivityId(PROCESS_TASK_KEY);
    assertNull(processTask);

    // the case instance has been completed
    CaseInstance caseInstance = caseService
        .createCaseInstanceQuery()
        .completed()
        .singleResult();

    assertNotNull(caseInstance);
    assertTrue(caseInstance.isCompleted());
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn"})
  public void testCompleteAnEnabledHumanTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .complete();
      fail("Should not be able to complete an enabled process task.");
    } catch (ProcessEngineException e) {}
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn"})
  public void testCompleteADisabledProcessTask() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    caseService
      .withCaseExecution(processTaskId)
      .disable();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .complete();
      fail("Should not be able to complete a disabled process task.");
    } catch (ProcessEngineException e) {}
  }

  @Deployment(resources={"org/camunda/bpm/engine/test/api/cmmn/oneProcessTaskCase.cmmn"})
  public void testClose() {
    // given
    createCaseInstance(DEFINITION_KEY);
    String processTaskId = queryCaseExecutionByActivityId(PROCESS_TASK_KEY).getId();

    try {
      // when
      caseService
        .withCaseExecution(processTaskId)
        .close();
      fail("It should not be possible to close a process task.");
    } catch (ProcessEngineException e) {

    }

  }

  protected CaseInstance createCaseInstance(String caseDefinitionKey) {
    return caseService
        .withCaseDefinitionByKey(caseDefinitionKey)
        .create();
  }

  protected CaseExecution queryCaseExecutionByActivityId(String activityId) {
    return caseService
        .createCaseExecutionQuery()
        .activityId(activityId)
        .singleResult();
  }

  protected ProcessInstance queryProcessInstance() {
    return runtimeService
        .createProcessInstanceQuery()
        .singleResult();
  }

  protected Task queryTask() {
    return taskService
        .createTaskQuery()
        .singleResult();
  }

}