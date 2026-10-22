# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[('index.html', '.'), ('multi.html', '.'), ('un.js', '.'), ('deux.js', '.'), ('trois.js', '.'), ('ia.js', '.'), ('ia-son-immediat.js', '.'), ('ia-immediat.js', '.'), ('tuto.js', '.'), ('bandeau.js', '.'), ('exercices.js', '.'), ('seances.js', '.'), ('plateforme.js', '.'), ('exercices.json', '.'), ('firmware.hex', '.'), ('logo.png', '.'), ('logo_ts.png', '.'), ('maqueenlite.png', '.'), ('readme.txt', '.'), ('lib', 'lib')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MicrobitBlockly_V2.0E',
    version='version_info.txt',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
