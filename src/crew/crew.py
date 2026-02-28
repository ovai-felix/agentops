"""AgentOpsCrew — orchestrates the monitor → investigate → remediate pipeline."""
from crewai import Crew, Process

from crew.agents import monitor_agent, investigator_agent, remediator_agent
from crew.tasks import create_monitor_task, create_investigation_task, create_remediation_task


class AgentOpsCrew:
    def run(self, context: str = "") -> str:
        """Run the full monitor → investigate → remediate pipeline."""
        monitor_task = create_monitor_task(context)
        investigate_task = create_investigation_task()
        remediate_task = create_remediation_task()

        # Sequential: investigate depends on monitor, remediate depends on investigate
        investigate_task.context = [monitor_task]
        remediate_task.context = [monitor_task, investigate_task]

        crew = Crew(
            agents=[monitor_agent, investigator_agent, remediator_agent],
            tasks=[monitor_task, investigate_task, remediate_task],
            process=Process.sequential,
            verbose=True,
        )
        result = crew.kickoff()
        return str(result)

    def run_monitor_only(self, context: str = "") -> str:
        """Run just the monitor task (for polling mode)."""
        crew = Crew(
            agents=[monitor_agent],
            tasks=[create_monitor_task(context)],
            process=Process.sequential,
            verbose=True,
        )
        return str(crew.kickoff())
