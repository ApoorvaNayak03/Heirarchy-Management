import { useState } from 'react';
import StepIndicator from '../../components/ui/StepIndicator';
import StepNavigation from '../../components/ui/StepNavigation';
import { WorkflowProvider, useWorkflow } from '../../context/WorkflowContext';
import Step1HierarchyType from './steps/Step1HierarchyType';
import Step10Activate from './steps/Step10Activate';
import Step2NodeTypes from './steps/Step2NodeTypes';
import Step3Properties from './steps/Step3Properties';
import Step4StructuralRules from './steps/Step4StructuralRules';
import Step5Version from './steps/Step5Version';
import Step6Build from './steps/Step6Build';
import Step7Validate from './steps/Step7Validate';
import Step8Submit from './steps/Step8Submit';
import Step9Approve from './steps/Step9Approve';

const STEP_COMPONENTS = {
  1: Step1HierarchyType,
  2: Step2NodeTypes,
  3: Step3Properties,
  4: Step4StructuralRules,
  5: Step5Version,
  6: Step6Build,
  7: Step7Validate,
  8: Step8Submit,
  9: Step9Approve,
  10: Step10Activate,
};

function WorkflowContent() {
  const { session, currentStepMeta, goToStep, goBack } = useWorkflow();
  const [stepActions, setStepActions] = useState({});
  const StepComponent = STEP_COMPONENTS[session.currentStep];

  return (
    <div className="flex min-h-[calc(100vh-49px)] flex-col">
      <StepIndicator
        currentStep={session.currentStep}
        maxCompletedStep={session.maxCompletedStep}
        onStepClick={goToStep}
      />

      <div className={`mx-auto w-full flex-1 px-4 py-5 ${[1, 2, 3, 4, 5, 6].includes(session.currentStep) ? 'max-w-[1400px]' : 'max-w-6xl'}`}>
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Step {session.currentStep} of 10
          </p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{currentStepMeta.title}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{currentStepMeta.description}</p>
        </header>

        {StepComponent && <StepComponent setActions={setStepActions} />}
      </div>

      <StepNavigation
        onBack={session.currentStep > 1 ? goBack : undefined}
        showBack={session.currentStep > 1 && stepActions.showBack !== false}
        {...stepActions}
      />
    </div>
  );
}

export default function WorkflowPage() {
  return (
    <WorkflowProvider>
      <WorkflowContent />
    </WorkflowProvider>
  );
}
