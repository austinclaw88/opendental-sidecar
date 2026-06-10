from __future__ import annotations
"""
Database module for AR Audit CLI.
Read-only MySQL connection to OpenDental.
"""

import os
from typing import Any, Dict, List, Optional
from mysql.connector import connect, MySQLConnection
from mysql.connector.cursor import MySQLCursorDict


def get_connection_string() -> str:
    """Get the MySQL connection string from environment variable."""
    conn_str = os.environ.get("OPENDENTAL_CONNECTION_STRING")
    if not conn_str:
        raise ValueError(
            "OPENDENTAL_CONNECTION_STRING environment variable is required.\n"
            "Example: "
            "OPENDENTAL_CONNECTION_STRING='Server=localhost;Port=3306;Database=opendental;User=readonly;Password=...'"
        )
    return conn_str


def parse_connection_string(conn_str: str) -> dict:
    """Parse a MySQL connection string (ODBC-style) into dict params."""
    parts = {}
    for pair in conn_str.split(";"):
        if "=" in pair:
            key, val = pair.split("=", 1)
            parts[key.strip().lower()] = val.strip()
    return {
        "host": parts.get("server", "localhost"),
        "port": int(parts.get("port", 3306)),
        "database": parts.get("database", "opendental"),
        "user": parts.get("user", parts.get("uid", "readonly")),
        "password": parts.get("password", ""),
    }


def connect_db(params: Optional[dict] = None) -> MySQLConnection:
    """Create and return a read-only MySQL connection.

    Args:
        params: Optional connection dict. If None, reads from OPENDENTAL_CONNECTION_STRING.

    Returns:
        MySQLConnection with dict cursor and autocommit enabled.
    """
    if params is None:
        conn_str = get_connection_string()
        params = parse_connection_string(conn_str)

    cnx = connect(
        host=params["host"],
        port=params["port"],
        database=params["database"],
        user=params["user"],
        password=params["password"],
        autocommit=True,
    )
    return cnx


def query_all(cnx: MySQLConnection, sql: str, params: Optional[dict] = None) -> List[Dict[str, Any]]:
    """Execute a SELECT query and return all rows as dicts."""
    cursor = cnx.cursor(dictionary=True)
    cursor.execute(sql, params or {})
    rows = cursor.fetchall()
    cursor.close()
    return rows


def query_one(cnx: MySQLConnection, sql: str, params: Optional[dict] = None) -> Optional[Dict[str, Any]]:
    """Execute a SELECT query and return the first row as dict, or None."""
    rows = query_all(cnx, sql, params)
    return rows[0] if rows else None
