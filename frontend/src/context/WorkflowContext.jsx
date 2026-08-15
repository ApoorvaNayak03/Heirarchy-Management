import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  WORKFLOW_STEPS,
  createEmptyWorkflow,
  getWorkflowSession,
  upsertWorkflowSession,
} from '../constants/workflow';
import { versionService } from '../services';

const WorkflowContext = createContext(null);

function inferStepFromVersion(status, maxCompletedStep) {
  if (status === 'ACTIVE') return 10;
  if (status === 'APPROVED') return 10;
  if (status === 'PENDING_APPROVAL') return Math.max(9, maxCompletedStep + 1);
  if (status === 'REJECTED') return Math.max(8, maxCompletedStep);
  return null;
}

export function WorkflowProvider({ children }) {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => {
    if (!workflowId) return createEmptyWorkflow();
    const existing = getWorkflowSession(workflowId);
    if (existing) return existing;
    return { ...createEmptyWorkflow(), id: workflowId };
  });

  useEffect(() => {
    if (!session.versionId) return;
    versionService.get(session.versionId).then((res) => {
      const inferred = inferStepFromVersion(res.data.status, session.maxCompletedStep);
      if (!inferred) return;
      const next = {
        ...session,
        versionStatus: res.data.status,
        currentStep: Math.max(session.currentStep, inferred),
        maxCompletedStep: Math.max(session.maxCompletedStep, inferred - 1),
      };
      if (next.currentStep !== session.currentStep || next.maxCompletedStep !== session.maxCompletedStep) {
        const saved = upsertWorkflowSession(next);
        setSession(saved);
      }
    }).catch(() => {});
  }, [session.versionId]);

  const persist = useCallback((next) => {
    const saved = upsertWorkflowSession(next);
    setSession(saved);
    return saved;
  }, []);

  const currentStepMeta = WORKFLOW_STEPS.find((s) => s.id === session.currentStep) || WORKFLOW_STEPS[0];

  const goToStep = useCallback((stepId) => {
    const maxReachable = Math.max(session.currentStep, session.maxCompletedStep + 1);
    if (stepId < 1 || stepId > maxReachable || stepId > WORKFLOW_STEPS.length) return;
    persist({ ...session, currentStep: stepId });
  }, [session, persist]);

  const completeStep = useCallback((stepId, updates = {}) => {
    persist({
      ...session,
      ...updates,
      currentStep: Math.min(stepId + 1, WORKFLOW_STEPS.length),
      maxCompletedStep: Math.max(session.maxCompletedStep, stepId),
    });
  }, [session, persist]);

  const updateSession = useCallback((updates) => {
    persist({ ...session, ...updates });
  }, [session, persist]);

  const goBack = useCallback(() => {
    if (session.currentStep > 1) goToStep(session.currentStep - 1);
  }, [session.currentStep, goToStep]);

  const exitWorkflow = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const value = useMemo(() => ({
    session,
    currentStepMeta,
    goToStep,
    completeStep,
    updateSession,
    goBack,
    exitWorkflow,
    persist,
  }), [session, currentStepMeta, goToStep, completeStep, updateSession, goBack, exitWorkflow, persist]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider');
  return ctx;
}
