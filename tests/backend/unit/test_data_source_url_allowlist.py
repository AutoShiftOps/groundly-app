# backend/routers/analysis.py's /api/analyze rejects a custom
# dataSourceUrl unless it's an https:// URL on a real City of
# Mississauga/Esri ArcGIS open-data host -- agents/mississauga_data.py's
# validate_data_source_url() is the single place that decision is made,
# tested here in isolation (no network call either way).
import pytest

from agents.mississauga_data import validate_data_source_url, DataSourceUrlError


@pytest.mark.parametrize("url", [
    "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2025_Mississauga_Business_Directory/FeatureServer/0/query",
    "https://www.mississauga.ca/some/open/data/endpoint",
    "https://maps.mississauga.ca/arcgis/rest/services/Foo/FeatureServer/0/query",
    "https://custom.arcgis.com/anything",
])
def test_allowed_hosts_pass(url):
    validate_data_source_url(url)  # must not raise


@pytest.mark.parametrize("url", [
    "http://services6.arcgis.com/not-https",  # right host, wrong scheme
    "https://evil.com/arcgis.com",  # host confusion, not an actual arcgis.com host
    "https://arcgis.com.evil.com/phishy",  # suffix spoofing attempt
    "https://example.com/arbitrary",
    "ftp://services6.arcgis.com/query",
    "not-a-url-at-all",
    "https://",
])
def test_disallowed_hosts_and_schemes_are_rejected(url):
    with pytest.raises(DataSourceUrlError):
        validate_data_source_url(url)


def test_rejection_message_names_the_actual_offending_host():
    with pytest.raises(DataSourceUrlError, match="example.com"):
        validate_data_source_url("https://example.com/arbitrary")
