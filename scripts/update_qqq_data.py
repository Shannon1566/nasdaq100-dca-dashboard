from pathlib import Path

import pandas as pd
import yfinance as yf


OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "NASDAQ100.csv"
TICKER = "QQQ"


def main() -> None:
    history = yf.Ticker(TICKER).history(period="max", interval="1d", auto_adjust=False)
    if history.empty:
        raise RuntimeError(f"No data returned for {TICKER}")

    close_series = history["Close"].dropna()
    if close_series.empty:
        raise RuntimeError(f"No closing prices returned for {TICKER}")

    df = close_series.rename("NASDAQ100").reset_index()
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
    df = df.rename(columns={"Date": "observation_date"})
    df = df[["observation_date", "NASDAQ100"]].sort_values("observation_date")
    df["NASDAQ100"] = df["NASDAQ100"].map(lambda value: f"{value:.3f}")
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Wrote {len(df)} rows to {OUTPUT_PATH}")
    print(f"Range: {df.iloc[0]['observation_date']} -> {df.iloc[-1]['observation_date']}")


if __name__ == "__main__":
    main()
