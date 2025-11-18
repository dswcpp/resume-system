#include <iostream>
#include <string>

enum class Event { Start, Success, Fail, Reset, Stop };

struct State;

struct Context {
    State* current{};
    void set(State* s) { current = s; }
    void dispatch(Event e);
};

struct State {
    virtual void handle(Context& ctx, Event e) = 0;
    virtual const char* name() const = 0;
    virtual ~State() = default;
};

struct Idle : State {
    void handle(Context& ctx, Event e) override;
    const char* name() const override { return "Idle"; }
    static Idle& instance() { static Idle s; return s; }
};

struct Processing : State {
    void handle(Context& ctx, Event e) override;
    const char* name() const override { return "Processing"; }
    static Processing& instance() { static Processing s; return s; }
};

struct Error : State {
    void handle(Context& ctx, Event e) override;
    const char* name() const override { return "Error"; }
    static Error& instance() { static Error s; return s; }
};

struct Done : State {
    void handle(Context& ctx, Event e) override;
    const char* name() const override { return "Done"; }
    static Done& instance() { static Done s; return s; }
};

void Context::dispatch(Event e) {
    std::cout << "[Event] "
              << (e == Event::Start ? "Start" :
                  e == Event::Success ? "Success" :
                  e == Event::Fail ? "Fail" :
                  e == Event::Reset ? "Reset" : "Stop")
              << " | State=" << (current ? current->name() : "<none>")
              << std::endl;
    if (current) current->handle(*this, e);
    std::cout << "[Next ] State=" << (current ? current->name() : "<none>") << std::endl;
}

void Idle::handle(Context& ctx, Event e) {
    if (e == Event::Start) ctx.set(&Processing::instance());
}

void Processing::handle(Context& ctx, Event e) {
    if (e == Event::Success) ctx.set(&Done::instance());
    else if (e == Event::Fail) ctx.set(&Error::instance());
    else if (e == Event::Reset || e == Event::Stop) ctx.set(&Idle::instance());
}

void Error::handle(Context& ctx, Event e) {
    if (e == Event::Reset) ctx.set(&Idle::instance());
    else if (e == Event::Start) ctx.set(&Processing::instance());
}

void Done::handle(Context& ctx, Event e) {
    if (e == Event::Reset) ctx.set(&Idle::instance());
}

int main() {
    Context ctx;
    ctx.set(&Idle::instance());
    ctx.dispatch(Event::Start);
    ctx.dispatch(Event::Success);
    ctx.dispatch(Event::Reset);
    ctx.dispatch(Event::Start);
    ctx.dispatch(Event::Fail);
    ctx.dispatch(Event::Reset);
    return 0;
}