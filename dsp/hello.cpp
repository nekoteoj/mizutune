extern "C" int add(int a, int b) { return a + b; }

#ifndef __EMSCRIPTEN__
int main() { return add(2, 3) == 5 ? 0 : 1; }
#endif
