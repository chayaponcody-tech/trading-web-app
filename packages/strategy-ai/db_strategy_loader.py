"""
db_strategy_loader.py
โหลด custom strategies จาก strategy_code/ folder ที่ Node.js บันทึกไว้
แต่ละไฟล์ชื่อ {uuid}.py และมี class ที่ extend BaseStrategy
"""
import os
import importlib.util
import logging

from base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

# path ของ strategy_code/ relative to project root (2 levels up from strategy-ai/)
DEFAULT_CODE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'strategy_code')


def load_db_strategies(registry, code_dir: str = DEFAULT_CODE_DIR) -> list:
    """
    สแกนไฟล์ .py ทั้งหมดใน code_dir แล้วโหลด class ที่ extend BaseStrategy
    ใช้ชื่อ class เป็น key ใน registry

    Returns:
        list ของ (key, filename) ที่โหลดสำเร็จ
    """
    loaded = []

    if not os.path.isdir(code_dir):
        logger.warning(f"[DBLoader] strategy_code dir not found: {code_dir}")
        return loaded

    for filename in os.listdir(code_dir):
        if not filename.endswith('.py'):
            continue

        filepath = os.path.join(code_dir, filename)
        module_name = f"db_strategy_{filename[:-3]}"

        # Read strategy_key from first line comment: # strategy_key: <name>
        strategy_key = None
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                if first_line.startswith('# strategy_key:'):
                    strategy_key = first_line.split(':', 1)[1].strip()
        except Exception:
            pass

        try:
            spec = importlib.util.spec_from_file_location(module_name, filepath)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        except Exception as e:
            logger.warning(f"[DBLoader] Failed to load {filename}: {e}")
            continue

        for attr_name in dir(module):
            obj = getattr(module, attr_name)
            if (
                isinstance(obj, type)
                and issubclass(obj, BaseStrategy)
                and obj is not BaseStrategy
            ):
                # Use strategy_key from comment, fallback to class name
                key = strategy_key or attr_name
                registry.register(key, obj())
                loaded.append((key, filename))
                logger.info(f"[DBLoader] Registered '{key}' from {filename}")
                break

    return loaded
