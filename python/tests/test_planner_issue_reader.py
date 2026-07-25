"""
Tests for Daedalus issue reader (TASK-D001)

These tests validate that:
1. GitHub issues are parsed correctly
2. Risk levels are classified accurately
3. Acceptance criteria are extracted
4. No-go areas are detected
5. Malformed input is handled gracefully
"""

import json
import pytest
from ocrowley_planner import parse_issue, IssueParser
from ocrowley_planner.issue_reader import RiskLevel


class TestIssueReader:
    """Test GitHub issue parsing."""
    
    @pytest.fixture
    def mock_issue(self):
        """Load mock GitHub issue from fixture."""
        with open("fixtures/mock_github_issue.json") as f:
            return json.load(f)
    
    def test_parse_valid_issue(self, mock_issue):
        """Test parsing a valid GitHub issue."""
        result = parse_issue(mock_issue)
        
        assert result.issue_id == "1"
        assert "issue reader" in result.title.lower()
        # Note: Mock issue contains "secret", "auth", "deploy" keywords so it's CRITICAL
        assert result.risk_level in [RiskLevel.CRITICAL, RiskLevel.ORANGE]
        assert "planner" in result.modules_affected
    
    def test_parse_malformed_issue(self):
        """Test handling of malformed issue (missing fields)."""
        malformed = {
            "number": 999,
            "title": "Test issue"
            # Missing 'body' field
        }
        result = parse_issue(malformed)
        
        assert result.issue_id == "999"
        assert result.description == ""
    
    def test_detect_risk_keywords(self):
        """Test risk keyword detection."""
        issue = {
            "number": 2,
            "title": "Add API key integration",
            "body": "We need to add a secret API key for Stripe billing"
        }
        result = parse_issue(issue)
        
        assert result.risk_level == RiskLevel.CRITICAL
        assert "api" in [k.lower() for k in result.risk_keywords_detected]
    
    def test_classify_risk_level_critical(self):
        """Test CRITICAL risk classification."""
        issue = {
            "number": 3,
            "title": "Deploy to production",
            "body": "Deploy main branch to production server"
        }
        result = parse_issue(issue)
        
        assert result.risk_level == RiskLevel.CRITICAL
        assert result.escalate
    
    def test_classify_risk_level_orange(self):
        """Test ORANGE risk classification."""
        issue = {
            "number": 4,
            "title": "Refactor database schema",
            "body": "Redesign the core database structure"
        }
        result = parse_issue(issue)
        
        assert result.risk_level == RiskLevel.ORANGE
    
    def test_classify_risk_level_yellow(self):
        """Test YELLOW risk classification."""
        issue = {
            "number": 5,
            "title": "Add new API endpoint",
            "body": "Create endpoint /api/v1/users"
        }
        result = parse_issue(issue)
        
        assert result.risk_level == RiskLevel.YELLOW
    
    def test_classify_risk_level_green(self):
        """Test GREEN risk classification."""
        issue = {
            "number": 6,
            "title": "Update documentation",
            "body": "Fix typos in README"
        }
        result = parse_issue(issue)
        
        assert result.risk_level == RiskLevel.GREEN
    
    def test_extract_acceptance_criteria(self):
        """Test extraction of acceptance criteria."""
        issue = {
            "number": 7,
            "title": "Test",
            "body": """
## Acceptance criteria
- Criterion A
- Criterion B
- Criterion C
"""
        }
        result = parse_issue(issue)
        
        assert len(result.acceptance_criteria) == 3
        assert "Criterion A" in result.acceptance_criteria
    
    def test_detect_no_go_areas(self):
        """Test detection of no-go area operations."""
        issue = {
            "number": 8,
            "title": "Add auth system",
            "body": "Implement OAuth2 and JWT tokens"
        }
        result = parse_issue(issue)
        
        # Should detect auth as a no-go area
        assert len(result.no_go_areas_detected) > 0 or result.risk_level == RiskLevel.CRITICAL
    
    def test_escalation_flag_critical(self):
        """Test escalation flag for CRITICAL issues."""
        issue = {
            "number": 9,
            "title": "Database destruction",
            "body": "Drop all tables and reset database"
        }
        result = parse_issue(issue)
        
        assert result.escalate
        assert result.escalation_reason is not None
    
    def test_unicode_handling(self):
        """Test handling of Unicode characters."""
        issue = {
            "number": 10,
            "title": "Add Unicode support ñ 中文 🎉",
            "body": "Support international characters"
        }
        result = parse_issue(issue)
        
        assert "ñ" in result.title or "中文" in result.title or "🎉" in result.title
    
    def test_very_long_issue_description(self):
        """Test handling of very long issue descriptions."""
        issue = {
            "number": 11,
            "title": "Long issue",
            "body": "A" * 10000  # 10k characters
        }
        result = parse_issue(issue)
        
        assert len(result.description) == 10000
    
    def test_empty_issue(self):
        """Test handling of empty issue."""
        issue = {
            "number": 12,
            "title": "",
            "body": ""
        }
        result = parse_issue(issue)
        
        assert result.title == ""
        assert result.description == ""
        # Should still classify (as GREEN by default)
        assert result.risk_level in [RiskLevel.GREEN, RiskLevel.YELLOW]


def test_issue_parser_to_dict():
    """Test conversion of ParsedIssue to dict."""
    from ocrowley_planner.issue_reader import ParsedIssue
    
    issue = ParsedIssue(
        issue_id="1",
        title="Test",
        description="Test",
        risk_level=RiskLevel.YELLOW
    )
    
    d = issue.to_dict()
    assert isinstance(d, dict)
    assert d["issue_id"] == "1"
    assert d["risk_level"] == "YELLOW"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
