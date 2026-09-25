cmake_minimum_required(VERSION 3.20)
project(mizutune_dsp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(EMSCRIPTEN)
  add_executable(mizutune hello.cpp)
  set_target_properties(mizutune PROPERTIES SUFFIX ".wasm")
  target_link_options(
    mizutune
    PRIVATE
      -sSTANDALONE_WASM=1
      --no-entry
      -sEXPORTED_FUNCTIONS=_add
      -sERROR_ON_UNDEFINED_SYMBOLS=0
  )
  add_custom_command(
    TARGET mizutune
    POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/../public
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:mizutune> ${CMAKE_SOURCE_DIR}/../public/mizutune.wasm
  )
else()
  add_executable(mizutune_dsp_test hello.cpp)
endif()
