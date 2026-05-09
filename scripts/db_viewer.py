#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
from pathlib import Path


DEFAULT_DB = Path.home() / ".local/share/com.commandcenter.desktop/command_center.sqlite3"


def connect(path: Path) -> sqlite3.Connection:
    if not path.exists():
        raise SystemExit(f"Database not found: {path}")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def table_names(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        """
        select name
        from sqlite_master
        where type = 'table' and name not like 'sqlite_%'
        order by name
        """
    ).fetchall()
    return [row["name"] for row in rows]


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f'pragma table_info("{table}")').fetchall()}


def assert_table(conn: sqlite3.Connection, table: str) -> None:
    if table not in table_names(conn):
        known = ", ".join(table_names(conn)) or "none"
        raise SystemExit(f"Unknown table '{table}'. Known tables: {known}")


def print_rows(rows: list[sqlite3.Row], *, max_width: int) -> None:
    if not rows:
        print("No rows")
        return

    dict_rows = [dict(row) for row in rows]
    columns = list(dict_rows[0].keys())
    widths = {
        column: min(
            max(len(column), *(len(format_value(row.get(column), max_width=max_width)) for row in dict_rows)),
            max_width,
        )
        for column in columns
    }

    print(" | ".join(column.ljust(widths[column]) for column in columns))
    print("-+-".join("-" * widths[column] for column in columns))
    for row in dict_rows:
        print(" | ".join(format_value(row.get(column), max_width=max_width).ljust(widths[column]) for column in columns))


def format_value(value, *, max_width: int) -> str:
    if value is None:
        text = ""
    elif isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=True)
    else:
        text = str(value)
    text = " ".join(text.split())
    if len(text) > max_width:
        return text[: max_width - 1] + "…"
    return text


def count_rows(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f'select count(*) as count from "{table}"').fetchone()["count"]


def print_summary(conn: sqlite3.Connection) -> None:
    names = table_names(conn)
    print("Database summary")
    print(f"Path: {database_path_label(conn)}")
    print()
    print("Tables")
    for name in names:
        print(f"- {name}: {count_rows(conn, name)} rows")

    if "ingestion_runs" in names:
        print_section(conn, "Recent ingestion runs", "select source, status, started_at, finished_at, notes from ingestion_runs order by started_at desc limit 5")

    if "articles" in names:
        article_columns = table_columns(conn, "articles")
        if {"provider", "query_lane", "accepted_for_analysis"}.issubset(article_columns):
            print_section(
                conn,
                "Article acceptance by provider/lane",
                """
                select
                  provider,
                  coalesce(query_lane, '') as lane,
                  accepted_for_analysis as accepted,
                  count(*) as rows
                from articles
                group by provider, query_lane, accepted_for_analysis
                order by provider, lane, accepted desc
                """,
            )
        else:
            print()
            print("Article acceptance by provider/lane")
            print("Not available until the updated Tauri app opens and migrates this database.")

        recent_columns = ["title", "source", "country_code", "category", "published_at"]
        if "query_lane" in article_columns:
            recent_columns.insert(4, "query_lane")
        if "market_relevance" in article_columns:
            recent_columns.insert(-1, "market_relevance")
        accepted_filter = "where accepted_for_analysis = 1" if "accepted_for_analysis" in article_columns else ""
        print_section(
            conn,
            "Recent articles",
            f"""
            select {", ".join(recent_columns)}
            from articles
            {accepted_filter}
            order by published_at desc
            limit 5
            """,
        )

    if "chat_threads" in names:
        print_section(conn, "Recent chat threads", "select id, title, updated_at from chat_threads order by updated_at desc limit 5")


def print_section(conn: sqlite3.Connection, title: str, query: str) -> None:
    print()
    print(title)
    print_rows(conn.execute(query).fetchall(), max_width=72)


def database_path_label(conn: sqlite3.Connection) -> str:
    row = conn.execute("pragma database_list").fetchone()
    return row["file"] if row and row["file"] else "(memory)"


def show_table(conn: sqlite3.Connection, table: str, limit: int, order: str | None, max_width: int) -> None:
    assert_table(conn, table)
    order_sql = f" order by {order}" if order else ""
    rows = conn.execute(f'select * from "{table}"{order_sql} limit ?', (limit,)).fetchall()
    print_rows(rows, max_width=max_width)


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect the Command Center SQLite database.")
    parser.add_argument("--db", default=os.environ.get("COMMAND_CENTER_DB", str(DEFAULT_DB)), help="Path to command_center.sqlite3")
    parser.add_argument("--table", "-t", help="Display rows from a table")
    parser.add_argument("--limit", "-n", type=int, default=20, help="Maximum rows to display")
    parser.add_argument("--order", help='Optional SQL order expression, for example "published_at desc"')
    parser.add_argument("--max-width", type=int, default=64, help="Maximum displayed width per column")
    parser.add_argument("--list", action="store_true", help="List table names and row counts")
    args = parser.parse_args()

    conn = connect(Path(args.db).expanduser())
    if args.list:
        for name in table_names(conn):
            print(f"{name}: {count_rows(conn, name)}")
        return

    if args.table:
        show_table(conn, args.table, args.limit, args.order, args.max_width)
        return

    print_summary(conn)


if __name__ == "__main__":
    main()
