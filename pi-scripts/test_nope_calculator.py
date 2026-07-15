import math

from nope_calculator import NopeCalculator


def test_calibrate_snapshot_matches_uw_nope_exactly_with_shared_snapshot():
    calc = NopeCalculator()
    snapshot = {
        "stock_vol": 1000,
        "call_delta_raw": 5000.0,
        "put_delta_raw": -2000.0,
    }
    uw = {
        "stock_vol": 1000,
        "call_delta": "5500",
        "put_delta": "-2600",
        "call_fill_delta": "4950",
        "put_fill_delta": "-3250",
        "nope": "2.9",
        "nope_fill": "1.7",
    }

    result = calc.calibrate_snapshot(snapshot, uw)

    assert math.isclose(result["nope_est"], 2.9)
    assert math.isclose(result["nope_fill_est"], 1.7)
    assert math.isclose(calc.k_call, 1.1)
    assert math.isclose(calc.k_put, 1.3)


def test_calibration_quality_rejects_bad_feed_alignment():
    quality = NopeCalculator.calibration_quality(
        local={"stock_vol": 100, "call_vol": 30, "put_vol": 40},
        uw={"stock_vol": 100, "call_vol": 100, "put_vol": 100},
    )

    assert quality["usable"] is False
    assert quality["call_volume_ratio"] == 0.3
    assert quality["put_volume_ratio"] == 0.4


def test_calibration_quality_accepts_well_aligned_feeds():
    quality = NopeCalculator.calibration_quality(
        local={"stock_vol": 100, "call_vol": 94, "put_vol": 108},
        uw={"stock_vol": 105, "call_vol": 100, "put_vol": 100},
    )

    assert quality["usable"] is True


def test_create_yfinance_session_prefers_curl_cffi_when_available(monkeypatch):
    sentinel = object()
    monkeypatch.setattr(
        NopeCalculator,
        "_new_curl_session",
        staticmethod(lambda: sentinel),
    )

    assert NopeCalculator.create_yfinance_session() is sentinel


def test_create_yfinance_session_falls_back_cleanly(monkeypatch):
    def unavailable():
        raise ImportError("curl_cffi missing")

    monkeypatch.setattr(
        NopeCalculator,
        "_new_curl_session",
        staticmethod(unavailable),
    )

    assert NopeCalculator.create_yfinance_session() is None


def test_get_spot_fallback_prefers_cumulative_volume_over_last_trade_size():
    class EmptyHistory:
        empty = True

    class FakeTicker:
        fast_info = {
            "lastPrice": 500,
            "lastVolume": 1,
            "volume": 5_000_000,
        }

        def history(self, period):
            return EmptyHistory()

    calc = NopeCalculator(session=object())

    assert calc.get_spot_and_volume(FakeTicker()) == (500.0, 5_000_000)


def test_fetch_unusual_whales_retries_transient_failure(monkeypatch):
    calls = []

    def fake_open(req, timeout):
        calls.append(req)
        if len(calls) == 1:
            raise TimeoutError("temporary")

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return b'{"data": [{"nope": "1.0"}]}'

        return Response()

    monkeypatch.setenv("UNUSUAL_WHALES_API_KEY", "test")
    monkeypatch.setattr("nope_calculator.urllib.request.urlopen", fake_open)
    monkeypatch.setattr("nope_calculator.time.sleep", lambda _: None)
    calc = NopeCalculator(session=object())

    assert calc.fetch_unusual_whales_nope("SPY") == [{"nope": "1.0"}]
    assert len(calls) == 2


def test_write_nope_detail_publishes_only_safe_product_fields(tmp_path):
    from nope_calculator import write_nope_detail

    destination = tmp_path / "nope-detail.json"
    result = write_nope_detail(
        {
            "SPY": {
                "timestamp": "2026-07-15T20:15:00Z",
                "spot_price": 753.44,
                "stock_vol": 50_000_000,
                "call_vol": 1_000_000,
                "put_vol": 800_000,
                "nope_est": 1.24,
                "nope_fill_est": 0.92,
                "call_delta_raw": 999,
                "put_delta_raw": -111,
            }
        },
        destination,
        generated_at="2026-07-15T20:20:00Z",
    )

    assert result == str(destination)
    payload = __import__("json").loads(destination.read_text())
    assert payload["generated_at"] == "2026-07-15T20:20:00Z"
    assert payload["symbols"]["SPY"] == {
        "spot_price": 753.44,
        "stock_volume": 50_000_000,
        "call_volume": 1_000_000,
        "put_volume": 800_000,
        "nope": 1.24,
        "nope_fill": 0.92,
    }
    assert "call_delta_raw" not in str(payload)


def test_calculate_and_publish_nope_does_not_depend_on_tiingo_or_turso(tmp_path, monkeypatch):
    from nope_calculator import calculate_and_publish_nope

    class FakeCalculator:
        def calculate_snapshot(self, symbol):
            return {
                "spot_price": 753.44,
                "stock_vol": 50_000_000,
                "call_vol": 1_000_000,
                "put_vol": 800_000,
                "nope_est": 1.24,
                "nope_fill_est": 0.92,
            }

    monkeypatch.setattr("nope_calculator.NopeCalculator", FakeCalculator)
    destination = tmp_path / "nope-detail.json"

    assert calculate_and_publish_nope(["SPY", "QQQ"], output_path=destination) == str(destination)
    assert __import__("json").loads(destination.read_text())["symbols"].keys() == {"SPY", "QQQ"}
