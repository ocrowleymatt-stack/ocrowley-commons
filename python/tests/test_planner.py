"""
Tests for Daedalus Planner Enhancement (EPIC D-02)

Tests:
- Scope analysis (in-scope vs. out-of-scope)
- Dependency detection and ordering
- Multi-phase plan generation
- Resource estimation
- Escalation detection
"""

import pytest
from ocrowley_planner.scope_analyzer import ScopeAnalyzer, ScopeStatus
from ocrowley_planner.dependency_analyzer import DependencyAnalyzer, DependencyType
from ocrowley_planner.enhanced_plan_generator import (
    EnhancedPlanGenerator,
    PlanStatus,
)


class TestScopeAnalysis:
    """Tests for scope validation."""
    
    def test_simple_bug_fix_in_scope(self):
        """Simple bug fixes should be in-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Fix TypeError in utils.py",
            "The parse_json function throws TypeError when input is None."
        )
        
        assert analysis.status == ScopeStatus.IN_SCOPE
        assert analysis.in_scope is True
        assert analysis.confidence >= 0.6
    
    def test_feature_request_in_scope(self):
        """Feature requests should be in-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Add exponential backoff retry logic",
            "Implement exponential backoff for API calls that fail temporarily."
        )
        
        assert analysis.status == ScopeStatus.IN_SCOPE
        assert analysis.in_scope is True
    
    def test_test_writing_in_scope(self):
        """Test writing should be in-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Add unit tests for auth module",
            "Write comprehensive unit tests covering all edge cases."
        )
        
        assert analysis.status == ScopeStatus.IN_SCOPE
        assert analysis.in_scope is True
    
    def test_documentation_in_scope(self):
        """Documentation updates should be in-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Update API documentation",
            "Add missing endpoint documentation to README."
        )
        
        assert analysis.status == ScopeStatus.IN_SCOPE
        assert analysis.in_scope is True
    
    def test_production_deploy_out_of_scope(self):
        """Production deployments should be flagged for escalation."""
        analysis = ScopeAnalyzer.analyze(
            "Deploy to production",
            "Deploy the new version to production environment."
        )
        
        # Production deployment has strong out-of-scope signals
        assert analysis.in_scope is False or analysis.status != ScopeStatus.IN_SCOPE
        assert "deploy" in analysis.reasons[0].lower() or "production" in analysis.reasons[0].lower()
    
    def test_infrastructure_change_out_of_scope(self):
        """Infrastructure changes should be out-of-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Migrate to Kubernetes",
            "Move deployment to Kubernetes cluster using Terraform."
        )
        
        assert analysis.status == ScopeStatus.OUT_OF_SCOPE
        assert analysis.in_scope is False
    
    def test_data_migration_out_of_scope(self):
        """Data migrations should be out-of-scope."""
        analysis = ScopeAnalyzer.analyze(
            "Migrate user data to new schema",
            "Perform database migration with schema changes."
        )
        
        assert analysis.status == ScopeStatus.OUT_OF_SCOPE
        assert analysis.in_scope is False
    
    def test_third_party_integration_out_of_scope(self):
        """Complex third-party integrations should require escalation."""
        analysis = ScopeAnalyzer.analyze(
            "Integrate Stripe payment processing",
            "Add Stripe payment integration for checkout flow."
        )
        
        # Payment processing detected as out-of-scope keyword
        assert "payment" in str(analysis.reasons).lower() or analysis.in_scope is not True
    
    def test_ambiguous_scope(self):
        """Ambiguous issues should be flagged for manual review."""
        analysis = ScopeAnalyzer.analyze(
            "Improve performance",
            "Make the application faster."
        )
        
        # This issue doesn't have strong in-scope or out-of-scope indicators
        assert analysis.confidence < 0.75  # Not strongly in-scope
        assert analysis.confidence > 0.35  # Not strongly out-of-scope


class TestDependencyAnalysis:
    """Tests for task dependency detection."""
    
    def test_no_dependencies(self):
        """Independent tasks should have no dependencies."""
        graph = DependencyAnalyzer.analyze_issue(
            "Update docs",
            "Update README and API docs",
            [
                "Update README.md with new examples",
                "Update CONTRIBUTING.md with guidelines"
            ]
        )
        
        assert len(graph.dependencies) == 0
        assert not graph.has_cycles
    
    def test_sequential_dependency(self):
        """Implementation before testing should be detected."""
        graph = DependencyAnalyzer.analyze_issue(
            "Add feature and tests",
            "Implement and test new feature",
            [
                "Implement new API endpoint",
                "Write unit tests for endpoint"
            ]
        )
        
        # Should detect that implementation comes before tests
        assert len(graph.phases) >= 1
    
    def test_blocking_dependency(self):
        """Setup tasks should block others."""
        graph = DependencyAnalyzer.analyze_issue(
            "Setup and build",
            "Initialize and build project",
            [
                "Setup database schema",
                "Initialize cache",
                "Build Docker image"
            ]
        )
        
        phases = graph.get_phases()
        # Should organize into phases with setup first
        assert len(phases) > 0
    
    def test_topological_sort(self):
        """Tasks should be sorted in valid execution order."""
        graph = DependencyAnalyzer.analyze_issue(
            "Build system",
            "Build with dependencies",
            [
                "Write core module",
                "Write tests",
                "Merge changes"
            ]
        )
        
        order = graph.topological_sort()
        assert len(order) > 0
        assert not graph.has_cycles
    
    def test_estimate_time_simple_task(self):
        """Simple tasks should be estimated as < 1 hour."""
        time = DependencyAnalyzer._estimate_time("Add simple validation check")
        assert time < 1.0
    
    def test_estimate_time_refactor(self):
        """Refactors should be estimated as > 2 hours."""
        time = DependencyAnalyzer._estimate_time("Refactor authentication module")
        assert time >= 2.0
    
    def test_complexity_estimation_high(self):
        """Complex work should be marked as high."""
        complexity = DependencyAnalyzer._estimate_complexity("Redesign API architecture")
        assert complexity == "high"
    
    def test_complexity_estimation_low(self):
        """Simple work should be marked as low."""
        complexity = DependencyAnalyzer._estimate_complexity("Fix small typo")
        assert complexity == "low"


class TestEnhancedPlanGeneration:
    """Tests for complete implementation plan generation."""
    
    def test_simple_bug_fix_plan(self):
        """Simple bug fix should generate executable plan."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=1,
            issue_title="Fix TypeError in parser",
            issue_body="The parser throws TypeError when input is None.",
            acceptance_criteria=[
                "Handle None input gracefully",
                "Add unit test for None case",
                "Update error message"
            ],
            risk_level="GREEN"
        )
        
        assert plan.status == PlanStatus.EXECUTABLE
        assert plan.in_scope is True
        assert not plan.escalation_required
        assert len(plan.phases) > 0
    
    def test_feature_request_plan(self):
        """Feature request should generate multi-phase plan."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=2,
            issue_title="Add exponential backoff retry",
            issue_body="Implement retry logic with exponential backoff.",
            acceptance_criteria=[
                "Implement RetryWithBackoff class",
                "Add configuration parameters",
                "Write unit tests",
                "Update documentation"
            ],
            risk_level="YELLOW"
        )
        
        assert plan.status == PlanStatus.EXECUTABLE
        assert len(plan.phases) > 0
        assert "Reviewer" in plan.suggested_approval_gates
    
    def test_production_deployment_plan(self):
        """Production deployments should require escalation."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=3,
            issue_title="Deploy to production",
            issue_body="Deploy release v1.0 to production.",
            acceptance_criteria=[
                "Deploy to production",
                "Run smoke tests",
                "Monitor metrics"
            ],
            risk_level="CRITICAL"
        )
        
        # Should be out-of-scope or require escalation
        assert plan.escalation_required is True
        assert "Emergency Board" in str(plan.suggested_approval_gates)
    
    def test_out_of_scope_plan(self):
        """Out-of-scope issues should be flagged."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=4,
            issue_title="Migrate to Kubernetes",
            issue_body="Move infrastructure to Kubernetes.",
            acceptance_criteria=[
                "Set up Kubernetes cluster",
                "Migrate services",
                "Update CI/CD"
            ],
            risk_level="RED"
        )
        
        assert plan.status == PlanStatus.OUT_OF_SCOPE
        assert plan.in_scope is False
    
    def test_plan_markdown_generation(self):
        """Plans should generate valid markdown."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=5,
            issue_title="Add logging",
            issue_body="Add comprehensive logging.",
            acceptance_criteria=[
                "Add logger configuration",
                "Add logging statements",
                "Test logging output"
            ],
            risk_level="GREEN"
        )
        
        markdown = plan.to_markdown()
        
        assert "# Implementation Plan" in markdown
        assert f"Issue #5" in markdown
        assert "Phase" in markdown or "Tasks" in markdown
    
    def test_large_effort_plan(self):
        """Large effort estimates should flag for manual review."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=6,
            issue_title="Massive refactor",
            issue_body="Refactor entire codebase.",
            acceptance_criteria=[
                f"Refactor module {i}" for i in range(1, 20)
            ],
            risk_level="YELLOW"
        )
        
        assert plan.total_estimated_hours > 24
        assert "Large effort" in str(plan.manual_review_needed) or \
               "Manual review" in plan.to_markdown()
    
    def test_complexity_levels(self):
        """Effort should correlate with complexity."""
        simple_plan = EnhancedPlanGenerator.generate(
            issue_id=7,
            issue_title="Typo fix",
            issue_body="Fix typo.",
            acceptance_criteria=["Fix typo in README"],
            risk_level="GREEN"
        )
        
        large_plan = EnhancedPlanGenerator.generate(
            issue_id=8,
            issue_title="Refactor",
            issue_body="Refactor modules.",
            acceptance_criteria=[f"Refactor module {i}" for i in range(10)],
            risk_level="YELLOW"
        )
        
        # Simple should be trivial/low complexity
        assert simple_plan.complexity_level in ["trivial", "low"]
        
        # Large should be medium/high
        assert large_plan.complexity_level in ["medium", "high"]
    
    def test_approval_gates_match_risk(self):
        """Approval gates should match risk level."""
        green = EnhancedPlanGenerator.generate(
            1, "Fix", "Fix", ["Fix"], "GREEN"
        )
        assert "Human" not in str(green.suggested_approval_gates)
        
        orange = EnhancedPlanGenerator.generate(
            2, "Change auth", "Change", ["Change"], "ORANGE"
        )
        assert "Human" in str(orange.suggested_approval_gates)
        
        critical = EnhancedPlanGenerator.generate(
            3, "Deploy", "Deploy", ["Deploy"], "CRITICAL"
        )
        assert "Emergency" in str(critical.suggested_approval_gates)


class TestD02EndToEnd:
    """End-to-end tests for D-02 workflow."""
    
    def test_full_workflow_simple_feature(self):
        """Complete workflow for simple feature."""
        # 1. Analyze scope
        scope = ScopeAnalyzer.analyze(
            "Add password validation",
            "Add password strength validation to signup form."
        )
        assert scope.in_scope is True
        
        # 2. Analyze dependencies
        graph = DependencyAnalyzer.analyze_issue(
            "Add password validation",
            "Add password strength validation.",
            [
                "Implement PasswordValidator class",
                "Add unit tests",
                "Update signup form",
                "Update documentation"
            ]
        )
        assert not graph.has_cycles
        
        # 3. Generate plan
        plan = EnhancedPlanGenerator.generate(
            issue_id=100,
            issue_title="Add password validation",
            issue_body="Add password strength validation to signup form.",
            acceptance_criteria=[
                "Implement PasswordValidator class",
                "Add unit tests",
                "Update signup form",
                "Update documentation"
            ],
            risk_level="YELLOW"
        )
        
        assert plan.status == PlanStatus.EXECUTABLE
        assert len(plan.phases) > 0
        assert "Reviewer" in plan.suggested_approval_gates
    
    def test_full_workflow_complex_feature(self):
        """Complete workflow for complex feature with dependencies."""
        plan = EnhancedPlanGenerator.generate(
            issue_id=101,
            issue_title="Add multi-factor authentication",
            issue_body="Implement 2FA with TOTP and SMS.",
            acceptance_criteria=[
                "Setup TOTP library integration",
                "Implement TOTP generation",
                "Implement SMS provider integration",
                "Update user model for 2FA flags",
                "Add 2FA enrollment flow",
                "Add 2FA verification flow",
                "Write comprehensive tests",
                "Update documentation"
            ],
            risk_level="ORANGE"
        )
        
        assert plan.status == PlanStatus.EXECUTABLE or plan.status == PlanStatus.REQUIRES_ESCALATION
        assert plan.total_estimated_hours > 4  # Complex feature
        assert "Human" in str(plan.suggested_approval_gates)
