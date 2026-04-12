import os
import importlib.util
import logging

from base_strategy import BaseStrategy

logger = logging.getLogger(__name__)


def load_pine_strategies(registry, strategies_dir: str) -> list:
    """
    สแกนไฟล์ pine_*.py ใน strategies_dir แล้วโหลดและลงทะเบียนใน registry

    Args:
        registry: StrategyRegistry instance
        strategies_dir: path ของ directory ที่เก็บไฟล์ strategy

    Returns:
        list ของ key ที่โหลดสำเร็จ (รูปแบบ PINE_{CLASSNAME})
    """
    loaded_keys = []

    try:
        filenames = os.listdir(strategies_dir)
    except FileNotFoundError:
        logger.warning(f"[PineLoader] strategies_dir not found: {strategies_dir}")
        return loaded_keys

    for filename in filenames:
        if not (filename.startswith("pine_") and filename.endswith(".py")):
            continue

        filepath = os.path.join(strategies_dir, filename)
        module_name = filename[:-3]  # ตัด .py ออก

        spec = importlib.util.spec_from_file_location(module_name, filepath)
        module = importlib.util.module_from_spec(spec)

        try:
            spec.loader.exec_module(module)
        except Exception as e:
            logger.warning(f"[PineLoader] Failed to load {filename}: {e}")
            continue

        for attr_name in dir(module):
            obj = getattr(module, attr_name)
            if (
                isinstance(obj, type)
                and issubclass(obj, BaseStrategy)
                and obj is not BaseStrategy
            ):
                key = f"PINE_{attr_name.upper()}"
                registry.register(key, obj())
                loaded_keys.append(key)
                logger.info(f"[PineLoader] Registered {key} from {filename}")
                break

    return loaded_keys
