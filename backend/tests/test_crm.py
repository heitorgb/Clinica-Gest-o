from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.crm.schemas import LeadCreate, LeadUpdate


def test_lead_create_defaults_and_normalization() -> None:
    lead = LeadCreate(
        name="  Mariana Lopes  ",
        phone="  (11) 98888-1040  ",
        email="mariana@example.com",
        origin="  Instagram  ",
    )

    assert lead.name == "Mariana Lopes"
    assert lead.phone == "(11) 98888-1040"
    assert lead.origin == "Instagram"
    assert lead.stage == "novo"
    assert lead.status == "open"
    assert lead.estimated_value == Decimal("0.00")


def test_lead_create_rejects_unknown_stage() -> None:
    with pytest.raises(ValidationError):
        LeadCreate(name="Mariana Lopes", stage="fechado")


def test_lead_update_allows_clearing_optional_fields() -> None:
    update = LeadUpdate(phone=None, notes="  ")

    assert update.phone is None
    assert update.notes is None
